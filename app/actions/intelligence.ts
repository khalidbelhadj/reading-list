// Server-only implementations for the intelligence layer (extracted content,
// embeddings, semantic search). Client code goes through the createServerFn
// RPC layer in ./index.ts, same as every other action module.
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { withUser } from "@/db";
import { itemContent, items } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import {
  assertOwnedItem,
  requireAuth,
  withCurrentUser,
} from "@/lib/db-helpers.server";
import { embedQuery, toVectorLiteral } from "@/lib/extract/embed.server";
import {
  extractFromHtml,
  UnsupportedContentError,
} from "@/lib/extract/extractors.server";
import {
  applyExtraction,
  drainAll,
  type DrainResult,
  enqueueItemContent,
  LEASE_MINUTES,
  MAX_ATTEMPTS,
  processPendingContent,
  reembedFromStored,
  reembedMissing,
  scheduleProcessing,
} from "@/lib/extract/worker.server";
import { ActionError, safeAction } from "@/lib/safe-action";
import {
  itemContentIdSchema,
  parseInput,
  relatedItemsSchema,
  semanticSearchSchema,
  submitLiveContentSchema,
} from "@/lib/schemas";
import { normalizeUrl } from "@/lib/url";

// ---------------------------------------------------------------------------
// Read: overview + per-item content (powers /read and /debug/intelligence)
// ---------------------------------------------------------------------------

const overviewRowSchema = z.object({
  item_id: z.string(),
  item_title: z.string(),
  url: z.string(),
  status: z.string(),
  source: z.string().nullable(),
  extractor: z.string().nullable(),
  word_count: z.number().nullable(),
  attempts: z.number(),
  error: z.string().nullable(),
  embedding_error: z.string().nullable(),
  has_embedding: z.boolean(),
  chunk_count: z.number(),
  fetched_at: z.string().nullable(),
  next_retry_at: z.string().nullable(),
  queue_state: z.string(),
});

export type ContentOverviewRow = {
  itemId: string;
  itemTitle: string;
  url: string;
  status: string;
  source: string | null;
  extractor: string | null;
  wordCount: number | null;
  attempts: number;
  error: string | null;
  embeddingError: string | null;
  hasEmbedding: boolean;
  chunkCount: number;
  fetchedAt: string | null;
  nextRetryAt: string | null;
  // Where this row sits in the extraction queue, derived from the same three
  // facts the worker's claim query uses (see queueStateSql below).
  queueState: QueueState;
};

// "none" = not in the queue at all (status is already ok/failed/unsupported).
export type QueueState = "none" | "queued" | "running" | "retry-wait" | "stuck";

export type IntelligenceOverview = {
  totalItems: number;
  rows: ContentOverviewRow[];
};

// Mirrors the worker's claim predicate exactly (lib/extract/worker.server.ts):
// a pending row is claimable when it has attempts left and no live lease.
// Claiming stamps next_retry_at = now() + LEASE_MINUTES, and a non-terminal
// failure stamps it an hour or six out — so the distance into the future is
// what separates "a worker is on it right now" from "waiting out a backoff".
// Evaluated in SQL so it uses the database's clock, not the browser's.
const queueStateSql = sql`
  CASE
    WHEN ic.status <> 'pending' THEN 'none'
    WHEN ic.attempts >= ${MAX_ATTEMPTS} THEN 'stuck'
    WHEN ic.next_retry_at IS NULL OR ic.next_retry_at < now() THEN 'queued'
    WHEN ic.next_retry_at <= now() + make_interval(mins => ${LEASE_MINUTES})
      THEN 'running'
    ELSE 'retry-wait'
  END`;

export const getIntelligenceOverview = safeAction(
  async function getIntelligenceOverview(): Promise<IntelligenceOverview> {
    return withCurrentUser(async (tx, userId) => {
      const [countRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(items)
        .where(eq(items.userId, userId));

      const raw = await tx.execute(sql`
        SELECT ic.item_id, i.title AS item_title, i.url, ic.status, ic.source,
          ic.extractor, ic.word_count, ic.attempts, ic.error,
          ic.embedding_error, (ic.embedding IS NOT NULL) AS has_embedding,
          COALESCE(c.chunk_count, 0)::int AS chunk_count,
          ic.fetched_at::text AS fetched_at,
          ic.next_retry_at::text AS next_retry_at,
          ${queueStateSql} AS queue_state
        FROM item_content ic
        JOIN items i ON i.id = ic.item_id
        LEFT JOIN (
          SELECT item_id, count(*)::int AS chunk_count
          FROM item_chunks WHERE user_id = ${userId} GROUP BY item_id
        ) c ON c.item_id = ic.item_id
        WHERE ic.user_id = ${userId}
        ORDER BY ic.updated_at DESC
      `);
      const rows = z.array(overviewRowSchema).parse(Array.from(raw));
      return {
        totalItems: countRow?.count ?? 0,
        rows: rows.map((row) => ({
          itemId: row.item_id,
          itemTitle: row.item_title,
          url: row.url,
          status: row.status,
          source: row.source,
          extractor: row.extractor,
          wordCount: row.word_count,
          attempts: row.attempts,
          error: row.error,
          embeddingError: row.embedding_error,
          hasEmbedding: row.has_embedding,
          chunkCount: row.chunk_count,
          fetchedAt: row.fetched_at,
          nextRetryAt: row.next_retry_at,
          queueState: row.queue_state as QueueState,
        })),
      };
    });
  },
  "Could not load the intelligence overview.",
);

export type ItemContentDetail = {
  status: string;
  source: string | null;
  extractor: string | null;
  title: string | null;
  markdown: string | null;
  wordCount: number | null;
  error: string | null;
  embeddingError: string | null;
  hasEmbedding: boolean;
  fetchedAt: string | null;
} | null;

export const getItemContent = safeAction(async function getItemContent(
  itemId: string,
): Promise<ItemContentDetail> {
  parseInput(itemContentIdSchema, { itemId });
  return withCurrentUser(async (tx, userId) => {
    const [row] = await tx
      .select({
        status: itemContent.status,
        source: itemContent.source,
        extractor: itemContent.extractor,
        title: itemContent.title,
        markdown: itemContent.markdown,
        wordCount: itemContent.wordCount,
        error: itemContent.error,
        embeddingError: itemContent.embeddingError,
        // Same truth source as getIntelligenceOverview — the vector column
        // itself, not embeddingModel — so one fact has one definition.
        // Computed in SQL to avoid pulling the 1536-float vector over the wire.
        hasEmbedding: sql<boolean>`${itemContent.embedding} IS NOT NULL`,
        fetchedAt: itemContent.fetchedAt,
      })
      .from(itemContent)
      .where(
        and(eq(itemContent.itemId, itemId), eq(itemContent.userId, userId)),
      )
      .limit(1);
    if (!row) return null;
    return row;
  });
}, "Could not load item content.");

// ---------------------------------------------------------------------------
// Pipeline controls
// ---------------------------------------------------------------------------

export const reextractItem = safeAction(async function reextractItem(
  itemId: string,
): Promise<ItemContentDetail> {
  parseInput(itemContentIdSchema, { itemId });
  await withCurrentUser(async (tx, userId) => {
    await assertOwnedItem(tx, userId, itemId);
    // Force a full re-run: clear the hash so unchanged content still rewrites
    // (useful after extractor changes), and reset job state.
    await enqueueItemContent(tx, userId, [itemId]);
    await tx
      .update(itemContent)
      .set({ contentHash: null })
      .where(
        and(eq(itemContent.itemId, itemId), eq(itemContent.userId, userId)),
      );
  });
  await processPendingContent(1, itemId);
  // getItemContent is itself a safeAction, so this re-authenticates and opens
  // a fresh transaction — accepted for this debug-page path.
  return getItemContent(itemId);
}, "Could not re-extract this item.");

// Runs cross-user on the owner connection (deliberate — the queue is global;
// backfillMyContent is the user-scoped entry point).
export const processQueueBatch = safeAction(
  async function processQueueBatch(): Promise<DrainResult> {
    await requireAuth();
    const result = await processPendingContent(10);
    // Also nibble at embedding gaps (quota hits leave status ok, vector null).
    await reembedMissing(3);
    return result;
  },
  "Could not process the extraction queue.",
);

// Repairs rows whose extraction succeeded but embedding failed (status ok,
// embedding NULL) — e.g. after a quota hit or transient embedding error.
// Loops reembedMissing in small batches until it stops finding work or the
// per-call cap is hit, so a single button click can clear a larger backlog.
// Runs cross-user on the owner connection (deliberate; see processQueueBatch).
export const retryMissingEmbeddings = safeAction(
  async function retryMissingEmbeddings(): Promise<{ healed: number }> {
    await requireAuth();
    let healed = 0;
    while (healed < 25) {
      const count = await reembedMissing(5);
      if (count === 0) break;
      healed += count;
    }
    return { healed };
  },
  "Could not retry missing embeddings.",
);

// Enqueue every item of the current user that has no content row yet, then
// drain in the background. Deliberate action (debug page button) — this is
// the "index my whole reading list" switch.
export const backfillMyContent = safeAction(
  async function backfillMyContent(): Promise<{ enqueued: number }> {
    const enqueued = await withCurrentUser(async (tx, userId) => {
      const raw = await tx.execute(sql`
        INSERT INTO item_content (item_id, user_id, status, created_at, updated_at)
        SELECT i.id, i.user_id, 'pending', now(), now()
        FROM items i
        WHERE i.user_id = ${userId}
          AND NOT EXISTS (SELECT 1 FROM item_content ic WHERE ic.item_id = i.id)
        RETURNING item_id
      `);
      return Array.from(raw).length;
    });
    if (enqueued > 0) drainAll();
    return { enqueued };
  },
  "Could not start the backfill.",
);

export const reembedItem = safeAction(async function reembedItem(
  itemId: string,
): Promise<boolean> {
  parseInput(itemContentIdSchema, { itemId });
  await withCurrentUser((tx, userId) => assertOwnedItem(tx, userId, itemId));
  return reembedFromStored(itemId);
}, "Could not re-embed this item.");

// ---------------------------------------------------------------------------
// Semantic search + related items
// ---------------------------------------------------------------------------

const semanticHitSchema = z.object({
  item_id: z.string(),
  item_title: z.string(),
  url: z.string(),
  read: z.boolean(),
  chunk_index: z.number(),
  snippet: z.string(),
  similarity: z.number(),
});

export type SemanticHit = {
  itemId: string;
  itemTitle: string;
  url: string;
  read: boolean;
  chunkIndex: number;
  snippet: string;
  similarity: number;
};

export const semanticSearch = safeAction(async function semanticSearch(
  query: string,
  limit?: number,
): Promise<SemanticHit[]> {
  const parsed = parseInput(semanticSearchSchema, { query, limit });
  // Authenticate before embedding — the provider call costs quota and must
  // not be reachable unauthenticated.
  await requireAuth();
  const vector = toVectorLiteral(await embedQuery(parsed.query));
  return withCurrentUser(async (tx, userId) => {
    const raw = await tx.execute(sql`
      SELECT c.item_id, i.title AS item_title, i.url, i.read,
        c.chunk_index, left(c.text, 400) AS snippet,
        (1 - (c.embedding <=> ${vector}::vector))::float8 AS similarity
      FROM item_chunks c
      JOIN items i ON i.id = c.item_id
      WHERE c.user_id = ${userId}
      ORDER BY c.embedding <=> ${vector}::vector
      LIMIT ${parsed.limit ?? 10}
    `);
    return z
      .array(semanticHitSchema)
      .parse(Array.from(raw))
      .map((row) => ({
        itemId: row.item_id,
        itemTitle: row.item_title,
        url: row.url,
        read: row.read,
        chunkIndex: row.chunk_index,
        snippet: row.snippet,
        similarity: row.similarity,
      }));
  });
}, "Could not run semantic search.");

const relatedItemSchema = z.object({
  item_id: z.string(),
  item_title: z.string(),
  url: z.string(),
  read: z.boolean(),
  similarity: z.number(),
});

export type RelatedItem = {
  itemId: string;
  itemTitle: string;
  url: string;
  read: boolean;
  similarity: number;
};

// Item-to-item nearest neighbors over the item-level vectors — the "read
// next" primitive.
export const getRelatedItems = safeAction(async function getRelatedItems(
  itemId: string,
  limit?: number,
): Promise<RelatedItem[]> {
  const parsed = parseInput(relatedItemsSchema, { itemId, limit });
  return withCurrentUser(async (tx, userId) => {
    const raw = await tx.execute(sql`
      SELECT other.item_id, i.title AS item_title, i.url, i.read,
        (1 - (other.embedding <=> me.embedding))::float8 AS similarity
      FROM item_content me
      JOIN item_content other
        ON other.user_id = me.user_id
        AND other.item_id <> me.item_id
        AND other.embedding IS NOT NULL
      JOIN items i ON i.id = other.item_id
      WHERE me.item_id = ${parsed.itemId}
        AND me.user_id = ${userId}
        AND me.embedding IS NOT NULL
      ORDER BY other.embedding <=> me.embedding
      LIMIT ${parsed.limit ?? 6}
    `);
    return z
      .array(relatedItemSchema)
      .parse(Array.from(raw))
      .map((row) => ({
        itemId: row.item_id,
        itemTitle: row.item_title,
        url: row.url,
        read: row.read,
        similarity: row.similarity,
      }));
  });
}, "Could not load related items.");

// ---------------------------------------------------------------------------
// Live capture (the in-app viewer's write path)
// ---------------------------------------------------------------------------

// Accepts the rendered DOM from the viewer (Electron webview preload) and
// runs the same readability → markdown step as the server fetch. Source
// "live" takes precedence over server extractions.
export const submitLiveContent = safeAction(
  async function submitLiveContent(input: {
    itemId: string;
    url: string;
    title?: string;
    html: string;
  }): Promise<{ ok: boolean; reason?: string }> {
    const parsed = parseInput(submitLiveContentSchema, input);
    const userId = await getCurrentUserId();

    const prior = await withUser(userId, async (tx) => {
      const [item] = await tx
        .select({ id: items.id, url: items.url })
        .from(items)
        .where(and(eq(items.id, parsed.itemId), eq(items.userId, userId)))
        .limit(1);
      if (!item) throw new ActionError("Item not found.");
      // Only accept captures of the item's own page — the viewer may navigate
      // elsewhere, and those pages are not this item's content.
      if (normalizeUrl(parsed.url) !== normalizeUrl(item.url)) {
        return null;
      }
      await enqueueItemContent(tx, userId, [parsed.itemId]);
      const [row] = await tx
        .select({
          source: itemContent.source,
          contentHash: itemContent.contentHash,
          embeddingModel: itemContent.embeddingModel,
          hasEmbedding: sql<boolean>`(${itemContent.embedding} IS NOT NULL)`,
        })
        .from(itemContent)
        .where(
          and(
            eq(itemContent.itemId, parsed.itemId),
            eq(itemContent.userId, userId),
          ),
        )
        .limit(1);
      return row ?? null;
    });
    if (!prior) return { ok: false, reason: "url-mismatch" };

    try {
      const extraction = extractFromHtml(parsed.html, parsed.url);
      await applyExtraction({
        itemId: parsed.itemId,
        userId,
        extraction: {
          ...extraction,
          title: extraction.title ?? parsed.title ?? null,
        },
        source: "live",
        prior: {
          source: prior.source,
          contentHash: prior.contentHash,
          hasEmbedding: prior.hasEmbedding,
          embeddingModel: prior.embeddingModel,
        },
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof UnsupportedContentError) {
        // Not an error worth surfacing — the page just isn't article-shaped.
        // Fall back to whatever the server pipeline produced.
        scheduleProcessing(parsed.itemId);
        return { ok: false, reason: "not-readable" };
      }
      throw error;
    }
  },
  "Could not save captured content.",
);
