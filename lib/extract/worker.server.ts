// Extraction worker. The item_content row IS the job: the claim query leases
// pending rows (attempts++ plus a next_retry_at lease) with FOR UPDATE SKIP
// LOCKED, so concurrent drains never double-process. Runs on the owner
// connection (plain `db`) because it drains across users; every row it
// touches was created inside a user-scoped transaction.
//
// Source precedence: live capture ("live") beats server fetch ("server") —
// a server re-extract never overwrites live-captured content, it just
// re-marks the row ok. Same-source rewrites are skipped when the content
// hash is unchanged (except to fill in missing embeddings).
import { createHash } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db, type Tx } from "@/db";
import { itemChunks, itemContent, items } from "@/db/schema";

import { chunkMarkdown } from "./chunk";
import { EMBEDDING_MODEL, embedDocuments, meanVector } from "./embed.server";
import {
  countWords,
  extractForUrl,
  type Extraction,
  EXTRACTOR_VERSION,
  UnsupportedContentError,
} from "./extractors.server";

// Exported so the intelligence overview can derive the same queue states this
// worker enforces (claimable / leased / backing off / stuck) instead of
// hard-coding a second copy of the numbers.
export const MAX_ATTEMPTS = 3;
// Lease while a claim is being processed; also the implicit retry delay if
// the process dies mid-extraction.
export const LEASE_MINUTES = 10;
// Backoff after a recorded failure: 1h after the first attempt, 6h after the
// second; the third failure is terminal ("failed").
const RETRY_DELAY_MINUTES = [60, 360];

export type ContentSource = "server" | "live" | "extension";

const nowIso = () => new Date().toISOString();

const sha256 = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// ---------------------------------------------------------------------------
// Enqueue (runs inside user-scoped transactions — RLS applies)
// ---------------------------------------------------------------------------

// Upsert a pending job without clobbering previously extracted content —
// only the job-control columns reset.
export const enqueueItemContent = async (
  tx: Tx | typeof db,
  userId: string,
  itemIds: string[],
): Promise<void> => {
  if (itemIds.length === 0) return;
  const now = nowIso();
  await tx
    .insert(itemContent)
    .values(
      itemIds.map((itemId) => ({
        itemId,
        userId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: itemContent.itemId,
      set: {
        status: "pending",
        attempts: 0,
        nextRetryAt: null,
        error: null,
        updatedAt: now,
      },
    });
};

// Fire-and-forget processing kick, delayed slightly so the enqueueing
// transaction has committed before the worker's claim query looks for the
// row. Never throws.
export const scheduleProcessing = (itemId?: string): void => {
  setTimeout(() => {
    void processPendingContent(itemId ? 1 : 5, itemId).catch((error) => {
      console.warn("[extract] background processing failed", error);
    });
  }, 1000);
};

// Background drain loop for backfills: keep processing batches until the
// queue is empty or the batch cap is hit. Fire-and-forget; never throws.
const MAX_DRAIN_BATCHES = 60;
export const drainAll = (): void => {
  void (async () => {
    for (let batch = 0; batch < MAX_DRAIN_BATCHES; batch++) {
      const result = await processPendingContent(5);
      if (result.processed === 0) return;
      console.log("[extract] drain batch", { batch, ...result });
    }
    console.warn("[extract] drainAll hit batch cap — more items pending");
  })().catch((error) => {
    console.warn("[extract] drainAll failed", error);
  });
};

// Opportunistic drain: called fire-and-forget from hot paths (fetchItems) so
// retries eventually run without a cron. Throttled hard.
let lastDrainAt = 0;
export const maybeDrainInBackground = (): void => {
  const now = Date.now();
  if (now - lastDrainAt < 60_000) return;
  lastDrainAt = now;
  setTimeout(() => {
    void processPendingContent(3)
      .then(() => reembedMissing(2))
      .catch((error) => {
        console.warn("[extract] background drain failed", error);
      });
  }, 50);
};

// ---------------------------------------------------------------------------
// Claim + process
// ---------------------------------------------------------------------------

const claimedRowSchema = z.object({
  item_id: z.string(),
  user_id: z.string(),
  attempts: z.number(),
  source: z.string().nullable(),
  content_hash: z.string().nullable(),
  embedding_model: z.string().nullable(),
  has_embedding: z.boolean(),
});

const claimRows = async (limit: number, onlyItemId?: string) => {
  const filter = onlyItemId ? sql` AND ic.item_id = ${onlyItemId}` : sql``;
  const rows = await db.execute(sql`
    UPDATE item_content SET
      attempts = attempts + 1,
      next_retry_at = now() + make_interval(mins => ${LEASE_MINUTES}),
      updated_at = now()
    WHERE item_id IN (
      SELECT ic.item_id FROM item_content ic
      WHERE ic.status = 'pending'
        AND ic.attempts < ${MAX_ATTEMPTS}
        AND (ic.next_retry_at IS NULL OR ic.next_retry_at < now())${filter}
      ORDER BY ic.updated_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING item_id, user_id::text AS user_id, attempts, source, content_hash,
      embedding_model, (embedding IS NOT NULL) AS has_embedding
  `);
  return z.array(claimedRowSchema).parse(Array.from(rows));
};

export type DrainResult = {
  processed: number;
  ok: number;
  failed: number;
};

export const processPendingContent = async (
  limit = 5,
  onlyItemId?: string,
): Promise<DrainResult> => {
  const claimed = await claimRows(limit, onlyItemId);
  if (claimed.length === 0) return { processed: 0, ok: 0, failed: 0 };

  const itemRows = await db
    .select({ id: items.id, url: items.url, title: items.title })
    .from(items)
    .where(
      inArray(
        items.id,
        claimed.map((row) => row.item_id),
      ),
    );
  const itemById = new Map(itemRows.map((row) => [row.id, row]));

  let ok = 0;
  let failed = 0;
  for (const row of claimed) {
    const item = itemById.get(row.item_id);
    if (!item) continue; // Deleted between claim and here; cascade cleans up.
    try {
      const extraction = await extractForUrl(item.url);
      await applyExtraction({
        itemId: row.item_id,
        userId: row.user_id,
        extraction,
        source: "server",
        prior: {
          source: row.source,
          contentHash: row.content_hash,
          hasEmbedding: row.has_embedding,
          embeddingModel: row.embedding_model,
        },
      });
      ok++;
    } catch (error) {
      failed++;
      await recordFailure(row.item_id, row.attempts, error);
    }
  }
  return { processed: claimed.length, ok, failed };
};

const recordFailure = async (
  itemId: string,
  attempts: number,
  error: unknown,
): Promise<void> => {
  const unsupported = error instanceof UnsupportedContentError;
  const terminal = unsupported || attempts >= MAX_ATTEMPTS;
  const delayMinutes = RETRY_DELAY_MINUTES[attempts - 1] ?? 360;
  console.warn("[extract] extraction failed", {
    itemId,
    attempts,
    terminal,
    error: errorMessage(error),
  });
  await db
    .update(itemContent)
    .set({
      status: terminal ? (unsupported ? "unsupported" : "failed") : "pending",
      error: errorMessage(error).slice(0, 2000),
      nextRetryAt: terminal
        ? null
        : new Date(Date.now() + delayMinutes * 60_000).toISOString(),
      updatedAt: nowIso(),
    })
    .where(eq(itemContent.itemId, itemId));
};

// ---------------------------------------------------------------------------
// Write path (shared by the worker and submitLiveContent)
// ---------------------------------------------------------------------------

type PriorState = {
  source: string | null;
  contentHash: string | null;
  hasEmbedding: boolean;
  embeddingModel: string | null;
};

export const applyExtraction = async (args: {
  itemId: string;
  userId: string;
  extraction: Extraction;
  source: ContentSource;
  prior: PriorState;
}): Promise<void> => {
  const { itemId, userId, extraction, source, prior } = args;
  const now = nowIso();

  // Precedence: a server fetch never overwrites live-captured content.
  if (source === "server" && prior.source === "live" && prior.contentHash) {
    await db
      .update(itemContent)
      .set({ status: "ok", error: null, nextRetryAt: null, updatedAt: now })
      .where(eq(itemContent.itemId, itemId));
    return;
  }

  const contentHash = sha256(extraction.markdown);
  const unchanged = contentHash === prior.contentHash;

  if (!unchanged) {
    await db
      .update(itemContent)
      .set({
        status: "ok",
        source,
        extractor: extraction.extractor,
        extractorVersion: EXTRACTOR_VERSION,
        contentHash,
        title: extraction.title,
        markdown: extraction.markdown,
        wordCount: countWords(extraction.markdown),
        error: null,
        nextRetryAt: null,
        fetchedAt: now,
        updatedAt: now,
      })
      .where(eq(itemContent.itemId, itemId));
  } else {
    await db
      .update(itemContent)
      .set({
        status: "ok",
        error: null,
        nextRetryAt: null,
        fetchedAt: now,
        updatedAt: now,
      })
      .where(eq(itemContent.itemId, itemId));
  }

  // Embed when content changed, or to fill a missing/stale-model embedding.
  const needsEmbedding =
    !unchanged ||
    !prior.hasEmbedding ||
    prior.embeddingModel !== EMBEDDING_MODEL;
  if (needsEmbedding) {
    try {
      await embedItemContent(itemId, userId, extraction);
    } catch (error) {
      console.warn("[extract] embedding failed", {
        itemId,
        error: errorMessage(error),
      });
      await db
        .update(itemContent)
        .set({
          embeddingError: errorMessage(error).slice(0, 2000),
          updatedAt: nowIso(),
        })
        .where(eq(itemContent.itemId, itemId));
    }
  }
};

const embedItemContent = async (
  itemId: string,
  userId: string,
  extraction: Extraction,
): Promise<void> => {
  const chunks = chunkMarkdown(extraction.markdown);
  if (chunks.length === 0) return;

  // Prefix each chunk with the title at embed time (not in the stored text)
  // so every vector carries the document's identity.
  const titlePrefix = extraction.title ? `${extraction.title}\n\n` : "";
  const vectors = await embedDocuments(
    chunks.map((chunk) => `${titlePrefix}${chunk}`),
  );
  const itemVector = meanVector(vectors);

  const now = nowIso();
  await db.transaction(async (tx) => {
    await tx.delete(itemChunks).where(eq(itemChunks.itemId, itemId));
    await tx.insert(itemChunks).values(
      chunks.map((chunk, index) => ({
        id: `${itemId}#${index}`,
        userId,
        itemId,
        chunkIndex: index,
        text: chunk,
        embedding: vectors[index]!,
        model: EMBEDDING_MODEL,
        createdAt: now,
      })),
    );
    await tx
      .update(itemContent)
      .set({
        embedding: itemVector,
        embeddingModel: EMBEDDING_MODEL,
        embeddingError: null,
        updatedAt: now,
      })
      .where(eq(itemContent.itemId, itemId));
  });
};

// Rows whose extraction succeeded but whose embedding didn't (typically a
// Gemini per-minute quota hit) — retried in small doses by the drain paths so
// coverage converges without burning quota.
export const reembedMissing = async (limit = 2): Promise<number> => {
  const rows = await db
    .select({ itemId: itemContent.itemId })
    .from(itemContent)
    .where(
      and(eq(itemContent.status, "ok"), sql`${itemContent.embedding} IS NULL`),
    )
    .orderBy(itemContent.updatedAt)
    .limit(limit);
  let ok = 0;
  for (const row of rows) {
    try {
      if (await reembedFromStored(row.itemId)) ok++;
    } catch (error) {
      await db
        .update(itemContent)
        .set({
          embeddingError: errorMessage(error).slice(0, 2000),
          updatedAt: nowIso(),
        })
        .where(eq(itemContent.itemId, row.itemId));
    }
  }
  return ok;
};

// Re-embed an item from its stored markdown (e.g. after an embedding-model
// change or a transient API failure) without re-fetching the source.
export const reembedFromStored = async (itemId: string): Promise<boolean> => {
  const [row] = await db
    .select({
      userId: itemContent.userId,
      markdown: itemContent.markdown,
      title: itemContent.title,
      extractor: itemContent.extractor,
    })
    .from(itemContent)
    .where(and(eq(itemContent.itemId, itemId), eq(itemContent.status, "ok")))
    .limit(1);
  if (!row?.markdown) return false;
  await embedItemContent(itemId, row.userId, {
    extractor: (row.extractor ?? "web") as Extraction["extractor"],
    title: row.title,
    markdown: row.markdown,
  });
  return true;
};
