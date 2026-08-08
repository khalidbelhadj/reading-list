// Server-only implementations for the intelligence layer: the extraction
// pipeline's job state, per-item content, and the embedding-model selection.
// Vector search lives in ./semantic-search.ts. Client code goes through the
// createServerFn RPC layer in ./index.ts, same as every other action module.
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { withUser } from "@/db";
import { itemContent, items } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { requireAuth, withCurrentUser } from "@/lib/db-helpers.server";
import {
  type EmbeddingConfig,
  embeddingConfigSchema,
} from "@/lib/extract/embedding-config";
import {
  getActiveModelId,
  getEmbeddingConfig,
  setEmbeddingConfig,
} from "@/lib/extract/embedding-config.server";
import { extractFromHtml } from "@/lib/extract/extractors.server";
import {
  FAILURE_REASONS,
  type FailureReason,
  IndexFailure,
} from "@/lib/extract/failure";
import { isPaused } from "@/lib/extract/pipeline-control.server";
import {
  applyLiveCapture,
  enqueueItems,
  type IndexState,
} from "@/lib/extract/worker.server";
import { ActionError, safeAction } from "@/lib/safe-action";
import {
  itemContentIdSchema,
  parseInput,
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
  state: z.string(),
  failure_reason: z.string().nullable(),
  failure_detail: z.string().nullable(),
  source: z.string().nullable(),
  extractor: z.string().nullable(),
  word_count: z.number().nullable(),
  embedding_model: z.string().nullable(),
  chunk_count: z.number(),
  fetched_at: z.string().nullable(),
});

export type ContentOverviewRow = {
  itemId: string;
  itemTitle: string;
  url: string;
  state: IndexState;
  // Set only when state is "failed". One of lib/extract/failure.ts's closed
  // set; the UI reads its metadata for the label and for whether to offer a
  // retry at all.
  failureReason: FailureReason | null;
  failureDetail: string | null;
  source: string | null;
  extractor: string | null;
  wordCount: number | null;
  embeddingModel: string | null;
  chunkCount: number;
  fetchedAt: string | null;
};

/** One row per distinct failure reason, for the failures list. */
export type FailureGroup = {
  reason: FailureReason;
  count: number;
  retryable: boolean;
};

/**
 * What the header says. `ready` is the headline and means the only thing a
 * reader would assume it means: extracted, embedded, and findable by search.
 *
 * The four counts partition the library exactly —
 * `ready + working + failed + notIndexed === totalItems` — which is the
 * property the old five-column arrangement could not offer, and the reason
 * nobody could tell whether the numbers added up.
 */
export type IndexSummary = {
  totalItems: number;
  ready: number;
  // pending + running: queued or being worked on right now.
  working: number;
  failed: number;
  // No content row at all — never queued.
  notIndexed: number;
  // Of `working`, the ones a worker holds this instant. Recorded, not
  // inferred from a timestamp.
  running: number;
  failures: FailureGroup[];
  paused: boolean;
  activeModel: string;
  // Rows carrying a vector from a previous model. They still count as ready
  // (they have text and a vector) but search filters to the active model, so
  // this is the "your model switch hasn't finished" number.
  staleModel: number;
};

export type IntelligenceOverview = {
  rows: ContentOverviewRow[];
  summary: IndexSummary;
};

const summarize = (
  rows: ContentOverviewRow[],
  totalItems: number,
  staleModel: number,
  activeModel: string,
  paused: boolean,
): IndexSummary => {
  let ready = 0;
  let working = 0;
  let running = 0;
  let failed = 0;
  const byReason = new Map<FailureReason, number>();
  for (const row of rows) {
    if (row.state === "ready") ready++;
    else if (row.state === "failed") {
      failed++;
      const reason = row.failureReason ?? "internal";
      byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
    } else {
      working++;
      if (row.state === "running") running++;
    }
  }
  const failures = [...byReason.entries()]
    .map(([reason, count]) => ({
      reason,
      count,
      retryable: FAILURE_REASONS[reason].retryable,
    }))
    .sort((a, b) => b.count - a.count);
  return {
    totalItems,
    ready,
    working,
    running,
    failed,
    notIndexed: Math.max(0, totalItems - rows.length),
    failures,
    paused,
    activeModel,
    staleModel,
  };
};

export const getIntelligenceOverview = safeAction(
  async function getIntelligenceOverview(): Promise<IntelligenceOverview> {
    const activeModel = await getActiveModelId();
    const paused = await isPaused();
    return withCurrentUser(async (tx, userId) => {
      const [countRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(items)
        .where(eq(items.userId, userId));

      const [staleRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(itemContent)
        .where(
          and(
            eq(itemContent.userId, userId),
            eq(itemContent.state, "ready"),
            sql`${itemContent.embeddingModel} IS DISTINCT FROM ${activeModel}`,
          ),
        );

      const raw = await tx.execute(sql`
        SELECT ic.item_id, i.title AS item_title, i.url, ic.state,
          ic.failure_reason, ic.failure_detail, ic.source, ic.extractor,
          ic.word_count, ic.embedding_model,
          COALESCE(c.chunk_count, 0)::int AS chunk_count,
          ic.fetched_at::text AS fetched_at
        FROM item_content ic
        JOIN items i ON i.id = ic.item_id
        LEFT JOIN (
          SELECT item_id, count(*)::int AS chunk_count
          FROM item_chunks WHERE user_id = ${userId} GROUP BY item_id
        ) c ON c.item_id = ic.item_id
        WHERE ic.user_id = ${userId}
        ORDER BY ic.updated_at DESC
      `);
      const parsed = z.array(overviewRowSchema).parse(Array.from(raw));
      const totalItems = countRow?.count ?? 0;
      const rows: ContentOverviewRow[] = parsed.map((row) => ({
        itemId: row.item_id,
        itemTitle: row.item_title,
        url: row.url,
        state: row.state as IndexState,
        failureReason: (row.failure_reason as FailureReason | null) ?? null,
        failureDetail: row.failure_detail,
        source: row.source,
        extractor: row.extractor,
        wordCount: row.word_count,
        embeddingModel: row.embedding_model,
        chunkCount: row.chunk_count,
        fetchedAt: row.fetched_at,
      }));
      return {
        rows,
        summary: summarize(
          rows,
          totalItems,
          staleRow?.count ?? 0,
          activeModel,
          paused,
        ),
      };
    });
  },
  "Could not load the index overview.",
);

export type ItemContentDetail = {
  state: IndexState;
  failureReason: FailureReason | null;
  failureDetail: string | null;
  source: string | null;
  extractor: string | null;
  title: string | null;
  markdown: string | null;
  wordCount: number | null;
  fetchedAt: string | null;
} | null;

export const getItemContent = safeAction(async function getItemContent(
  itemId: string,
): Promise<ItemContentDetail> {
  parseInput(itemContentIdSchema, { itemId });
  return withCurrentUser(async (tx, userId) => {
    const [row] = await tx
      .select({
        state: itemContent.state,
        failureReason: itemContent.failureReason,
        failureDetail: itemContent.failureDetail,
        source: itemContent.source,
        extractor: itemContent.extractor,
        title: itemContent.title,
        markdown: itemContent.markdown,
        wordCount: itemContent.wordCount,
        fetchedAt: itemContent.fetchedAt,
      })
      .from(itemContent)
      .where(
        and(eq(itemContent.itemId, itemId), eq(itemContent.userId, userId)),
      )
      .limit(1);
    if (!row) return null;
    return {
      ...row,
      state: row.state as IndexState,
      failureReason: (row.failureReason as FailureReason | null) ?? null,
    };
  });
}, "Could not load item content.");

// Chunks as they were actually stored — the text that was embedded and the
// model it went out under. This is the ground truth behind a search hit, so
// the detail drawer reads it rather than reconstructing chunks client-side.
const chunkRowSchema = z.object({
  chunk_index: z.number(),
  text: z.string(),
  model: z.string(),
});

export type ItemChunk = {
  chunkIndex: number;
  text: string;
  model: string;
};

export const getItemChunks = safeAction(async function getItemChunks(
  itemId: string,
): Promise<ItemChunk[]> {
  parseInput(itemContentIdSchema, { itemId });
  return withCurrentUser(async (tx, userId) => {
    const raw = await tx.execute(sql`
      SELECT chunk_index, text, model
      FROM item_chunks
      WHERE item_id = ${itemId} AND user_id = ${userId}
      ORDER BY chunk_index
    `);
    return z
      .array(chunkRowSchema)
      .parse(Array.from(raw))
      .map((row) => ({
        chunkIndex: row.chunk_index,
        text: row.text,
        model: row.model,
      }));
  });
}, "Could not load chunks for this item.");

// ---------------------------------------------------------------------------
// Embedding model selection (app-global — see embedding-config.server.ts)
// ---------------------------------------------------------------------------

export const getEmbeddingSettings = safeAction(
  async function getEmbeddingSettings(): Promise<EmbeddingConfig> {
    await requireAuth();
    return getEmbeddingConfig();
  },
  "Could not load the embedding settings.",
);

// Switching the model does not invalidate anything by itself: existing rows
// keep their vectors and their stored model id, searches start filtering to
// the new model, and the drain paths re-embed the stale rows in the
// background (reembedMissing). That ordering is deliberate — nothing is
// deleted, so a switch is reversible until the re-embed completes.
export const updateEmbeddingSettings = safeAction(
  async function updateEmbeddingSettings(
    next: EmbeddingConfig,
  ): Promise<EmbeddingConfig> {
    await requireAuth();
    const parsed = parseInput(embeddingConfigSchema, next);
    try {
      return await setEmbeddingConfig(parsed);
    } catch (error) {
      throw new ActionError(
        error instanceof Error ? error.message : "Invalid embedding model.",
      );
    }
  },
  "Could not update the embedding settings.",
);

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

    const ok = await withUser(userId, async (tx) => {
      const [item] = await tx
        .select({ id: items.id, url: items.url })
        .from(items)
        .where(and(eq(items.id, parsed.itemId), eq(items.userId, userId)))
        .limit(1);
      if (!item) throw new ActionError("Item not found.");
      // Only accept captures of the item's own page — the viewer may navigate
      // elsewhere, and those pages are not this item's content.
      if (normalizeUrl(parsed.url) !== normalizeUrl(item.url)) return false;
      await enqueueItems(tx, userId, [parsed.itemId]);
      return true;
    });
    if (!ok) return { ok: false, reason: "url-mismatch" };

    try {
      const extraction = extractFromHtml(parsed.html, parsed.url);
      await applyLiveCapture(parsed.itemId, userId, {
        ...extraction,
        title: extraction.title ?? parsed.title ?? null,
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof IndexFailure && error.reason === "not_readable") {
        // Not worth surfacing: the rendered page just isn't article-shaped.
        // The row is already queued, so the server extractor gets its turn.
        return { ok: false, reason: "not-readable" };
      }
      throw error;
    }
  },
  "Could not save captured content.",
);
