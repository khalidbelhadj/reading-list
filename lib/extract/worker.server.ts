// The indexer: one loop, one job, four states.
//
//   pending → running → ready
//                    ↘ failed (with a typed reason)
//
// A row is `ready` only when it has both extracted text and an embedding from
// the current model. There is no half-indexed state, because "extracted but
// not searchable" is what nobody could name before.
//
// What is deliberately NOT here, having been removed: leases, attempt counts,
// retry backoff, a claim predicate mirrored in SQL, rows that fall out of the
// state machine and need sweeping, and four different ways to kick the queue.
// One interval owns the work. Retrying is a button — a failure that a person
// can see and act on beats one that silently reschedules itself for six hours
// from now.
//
// Runs on the owner connection (plain `db`) because it drains across users;
// every row it touches was created inside a user-scoped transaction.
import { createHash } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db, type Tx } from "@/db";
import { itemContent } from "@/db/schema";

import { embedItems, type EmbedSource } from "./embed-items.server";
import { getActiveModelId } from "./embedding-config.server";
import {
  countWords,
  extractForUrl,
  type Extraction,
  EXTRACTOR_VERSION,
} from "./extractors.server";
import {
  DETAIL_CAP,
  type FailureReason,
  type IndexFailure,
  toIndexFailure,
} from "./failure";
import { isPaused } from "./pipeline-control.server";

export type IndexState = "pending" | "running" | "ready" | "failed";

type ContentSource = "server" | "live" | "extension";

// How many items one pass takes. Also the embedding batch size, since the
// pass embeds everything it extracted in a single provider call.
const BATCH = 8;
// Gap between passes when there is work. Long enough not to hammer a local
// model, short enough that a newly added item indexes while you are still
// looking at it.
const TICK_MS = 4_000;
// Gap after an empty pass. Nothing is waiting, so ask less often.
const IDLE_TICK_MS = 30_000;
// Ceiling for the failure backoff: ~17 minutes. A dependency that has been
// broken this long needs a person, not another connection attempt.
const MAX_BACKOFF_MS = 1_024_000;

const nowIso = () => new Date().toISOString();

const sha256 = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

// ---------------------------------------------------------------------------
// Writing outcomes
// ---------------------------------------------------------------------------

const markFailed = async (
  itemId: string,
  failure: IndexFailure,
): Promise<void> => {
  await db
    .update(itemContent)
    .set({
      state: "failed",
      failureReason: failure.reason,
      failureDetail: failure.detail?.slice(0, DETAIL_CAP) ?? null,
      updatedAt: nowIso(),
    })
    .where(eq(itemContent.itemId, itemId));
};

const markReady = async (itemId: string): Promise<void> => {
  await db
    .update(itemContent)
    .set({
      state: "ready",
      failureReason: null,
      failureDetail: null,
      updatedAt: nowIso(),
    })
    .where(eq(itemContent.itemId, itemId));
};

// ---------------------------------------------------------------------------
// Enqueue (runs inside user-scoped transactions — RLS applies)
// ---------------------------------------------------------------------------

/**
 * Queues items for indexing.
 *
 * By default the stored text is kept, so a re-queued row skips extraction and
 * goes straight to embedding — that is what makes a re-embed cheap. Pass
 * `discardText` when the text is no longer *about* the right page (the item's
 * URL changed), because otherwise the pass would happily re-embed the old
 * article and the row would look freshly indexed while describing the wrong
 * thing.
 */
export const enqueueItems = async (
  tx: Tx | typeof db,
  userId: string,
  itemIds: string[],
  options?: { discardText?: boolean },
): Promise<void> => {
  if (itemIds.length === 0) return;
  const now = nowIso();
  const discard = options?.discardText === true;
  await tx
    .insert(itemContent)
    .values(
      itemIds.map((itemId) => ({
        itemId,
        userId,
        state: "pending",
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: itemContent.itemId,
      set: {
        state: "pending",
        failureReason: null,
        failureDetail: null,
        updatedAt: now,
        ...(discard ? { markdown: null, contentHash: null } : {}),
      },
    });
};

// ---------------------------------------------------------------------------
// One pass
// ---------------------------------------------------------------------------

const claimedSchema = z.object({
  item_id: z.string(),
  user_id: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  markdown: z.string().nullable(),
  content_hash: z.string().nullable(),
});

type Claimed = z.infer<typeof claimedSchema>;

// SKIP LOCKED still earns its place: it is one clause, and it means two
// processes (the desktop app and a hosted instance) never pick the same row.
// What it is NOT is a lease — the row moves to 'running' and stays there until
// this pass finishes it, and a process that dies leaves it there for
// resetRunning() to reclaim at the next boot.
const claimBatch = async (limit: number): Promise<Claimed[]> => {
  const rows = await db.execute(sql`
    UPDATE item_content SET state = 'running', updated_at = now()
    WHERE item_id IN (
      SELECT ic.item_id FROM item_content ic
      WHERE ic.state = 'pending'
      ORDER BY ic.updated_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING item_id, user_id::text AS user_id, title, markdown, content_hash,
      (SELECT i.url FROM items i WHERE i.id = item_content.item_id) AS url
  `);
  return z.array(claimedSchema).parse(Array.from(rows));
};

/**
 * Rows left `running` by a process that died. Called once at startup: if this
 * process is only now booting, nothing it can see is genuinely in flight.
 *
 * This replaces the old stuck-row problem rather than renaming it. Before, a
 * row that was claimed three times without ever recording a failure ran out of
 * attempts while still `pending`, which made it permanently unclaimable and
 * invisible — and needed a dedicated sweep to find. Now the same crash leaves
 * a row in `running`, which is plainly visible, and boot puts it back.
 */
const resetRunning = async (): Promise<number> => {
  const rows = await db.execute(sql`
    UPDATE item_content SET state = 'pending', updated_at = now()
    WHERE state = 'running'
    RETURNING item_id
  `);
  return Array.from(rows).length;
};

const storeExtraction = async (
  itemId: string,
  extraction: Extraction,
  source: ContentSource,
): Promise<void> => {
  const now = nowIso();
  await db
    .update(itemContent)
    .set({
      source,
      extractor: extraction.extractor,
      extractorVersion: EXTRACTOR_VERSION,
      contentHash: sha256(extraction.markdown),
      title: extraction.title,
      markdown: extraction.markdown,
      wordCount: countWords(extraction.markdown),
      fetchedAt: now,
      updatedAt: now,
    })
    .where(eq(itemContent.itemId, itemId));
};

export type PassResult = { indexed: number; failed: number };

/**
 * Extract anything missing text, then embed the whole batch in one call.
 *
 * The two steps are separate because they fail for unrelated reasons and only
 * the second one is worth batching: extraction is N network fetches of N
 * different sites, embedding is one request to one model.
 */
export const runPass = async (limit = BATCH): Promise<PassResult> => {
  const claimed = await claimBatch(limit);
  if (claimed.length === 0) return { indexed: 0, failed: 0 };

  let failed = 0;
  const sources: EmbedSource[] = [];

  for (const row of claimed) {
    // Text we already have is text we don't re-fetch: a row that failed at the
    // embed step, or is being re-embedded for a new model, skips straight to
    // the second half.
    if (row.markdown && row.content_hash) {
      sources.push({
        itemId: row.item_id,
        userId: row.user_id,
        title: row.title,
        markdown: row.markdown,
      });
      continue;
    }
    try {
      const extraction = await extractForUrl(row.url);
      await storeExtraction(row.item_id, extraction, "server");
      sources.push({
        itemId: row.item_id,
        userId: row.user_id,
        title: extraction.title,
        markdown: extraction.markdown,
      });
    } catch (error) {
      failed++;
      await markFailed(row.item_id, toIndexFailure(error));
    }
  }

  const outcomes = await embedItems(sources);
  let indexed = 0;
  for (const outcome of outcomes) {
    if (outcome.result === "embedded") {
      indexed++;
      await markReady(outcome.itemId);
    } else {
      failed++;
      await markFailed(outcome.itemId, outcome.failure);
    }
  }
  return { indexed, failed };
};

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

let timer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;
// Consecutive failed passes. Drives the backoff below, and reset to 0 by any
// pass that gets as far as talking to the database.
let consecutiveFailures = 0;

const schedule = (delay: number) => {
  if (stopped) return;
  timer = setTimeout(() => void tick(), delay);
};

/**
 * How long to wait after a pass that threw.
 *
 * A background loop that retries a broken dependency on a fixed schedule is
 * not resilient, it is a load generator. With bad database credentials this
 * loop produced a failed authentication every 30 seconds forever, which is
 * what Supabase's circuit breaker counts — and once it trips it blocks *new
 * connections for the whole project*, so an indexer that could not do its own
 * job took the rest of the app down with it.
 *
 * So: exponential, and capped well above the point where a human would have
 * noticed. The queue is not urgent; nothing is lost by waiting.
 */
const failureDelay = (failures: number): number =>
  Math.min(IDLE_TICK_MS * 2 ** (failures - 1), MAX_BACKOFF_MS);

const tick = async (): Promise<void> => {
  let delay = IDLE_TICK_MS;
  try {
    if (await isPaused()) return;
    const result = await runPass();
    consecutiveFailures = 0;
    if (result.indexed + result.failed > 0) {
      delay = TICK_MS;
      console.log("[index] pass", result);
    }
  } catch (error) {
    // A pass must never take the loop down with it — the next one may well
    // succeed, and a dead indexer is far harder to notice than a slow one.
    // But it must not keep knocking at the same rate either.
    consecutiveFailures++;
    delay = failureDelay(consecutiveFailures);
    console.warn("[index] pass failed", {
      consecutiveFailures,
      retryInSeconds: Math.round(delay / 1000),
      error,
    });
  } finally {
    schedule(delay);
  }
};

/**
 * Starts the indexer. Called once from the server entry; safe to call twice.
 *
 * This is the only thing that makes indexing happen. It replaces a setTimeout
 * on item creation, a throttled piggyback on fetchItems, a 60-batch drain
 * loop, and three buttons — all of which had their own limits, and none of
 * which ran unless somebody happened to open the app.
 */
export const startIndexer = (): void => {
  if (timer) return;
  stopped = false;
  void resetRunning()
    .then((reclaimed) => {
      if (reclaimed > 0) {
        console.log(
          "[index] reclaimed rows left running by a previous process",
          {
            reclaimed,
          },
        );
      }
    })
    .catch((error) => console.warn("[index] reclaim failed", error))
    .finally(() => schedule(TICK_MS));
};

// ---------------------------------------------------------------------------
// Requeue helpers (the buttons)
// ---------------------------------------------------------------------------

/** Re-index specific items from scratch, discarding the stored text. */
export const requeueItems = async (
  userId: string,
  itemIds: string[],
): Promise<number> => {
  if (itemIds.length === 0) return 0;
  const rows = await db
    .update(itemContent)
    .set({
      state: "pending",
      contentHash: null,
      markdown: null,
      failureReason: null,
      failureDetail: null,
      updatedAt: nowIso(),
    })
    .where(
      and(eq(itemContent.userId, userId), inArray(itemContent.itemId, itemIds)),
    )
    .returning({ itemId: itemContent.itemId });
  return rows.length;
};

/**
 * Retry failures worth retrying. `reasons` is the caller's filter — the UI
 * passes only the reasons whose metadata says retrying can work, so the
 * button never promises to re-fetch a page that has already been established
 * to contain no article.
 */
export const requeueFailed = async (
  userId: string,
  reasons: FailureReason[],
): Promise<number> => {
  if (reasons.length === 0) return 0;
  const rows = await db
    .update(itemContent)
    .set({
      state: "pending",
      failureReason: null,
      failureDetail: null,
      updatedAt: nowIso(),
    })
    .where(
      and(
        eq(itemContent.userId, userId),
        eq(itemContent.state, "failed"),
        inArray(itemContent.failureReason, reasons),
      ),
    )
    .returning({ itemId: itemContent.itemId });
  return rows.length;
};

/**
 * Queue every row whose vector predates the current model. Called after a
 * model switch: the stored text is kept, so this costs embedding only.
 */
export const requeueStaleModel = async (): Promise<number> => {
  const activeModel = await getActiveModelId();
  const rows = await db.execute(sql`
    UPDATE item_content SET state = 'pending', updated_at = now()
    WHERE state = 'ready'
      AND embedding_model IS DISTINCT FROM ${activeModel}
    RETURNING item_id
  `);
  return Array.from(rows).length;
};

// ---------------------------------------------------------------------------
// Live capture (the in-app viewer's write path)
// ---------------------------------------------------------------------------

/**
 * Text captured from the rendered page in the viewer. Takes precedence over
 * anything the server fetched — it is the page as the user actually saw it,
 * past whatever wall the server hit.
 */
export const applyLiveCapture = async (
  itemId: string,
  userId: string,
  extraction: Extraction,
): Promise<void> => {
  await storeExtraction(itemId, extraction, "live");
  const outcomes = await embedItems([
    { itemId, userId, title: extraction.title, markdown: extraction.markdown },
  ]);
  const outcome = outcomes[0];
  if (!outcome || outcome.result === "embedded") {
    await markReady(itemId);
    return;
  }
  await markFailed(itemId, outcome.failure);
};
