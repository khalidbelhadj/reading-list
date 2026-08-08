// Server-only implementations for the indexer's controls. The reads that
// describe its state live in ./intelligence.
//
// There are four, and that is the whole surface: pause, index everything,
// retry what can be retried, and re-index these specific items. The loop
// (lib/extract/worker.server.ts) does the rest on its own, so there is nothing
// here that starts, stops, or steers a pass.
import { sql } from "drizzle-orm";

import { requireAuth, withCurrentUser } from "@/lib/db-helpers.server";
import {
  FAILURE_REASON_VALUES,
  FAILURE_REASONS,
  type FailureReason,
} from "@/lib/extract/failure";
import { isPaused, setPaused } from "@/lib/extract/pipeline-control.server";
import {
  requeueFailed,
  requeueItems,
  requeueStaleModel,
} from "@/lib/extract/worker.server";
import { safeAction } from "@/lib/safe-action";

export type PipelineRunState = { paused: boolean };

export const getPipelineRunState = safeAction(
  async function getPipelineRunState(): Promise<PipelineRunState> {
    await requireAuth();
    return { paused: await isPaused() };
  },
  "Could not read the indexer state.",
);

export const setPipelinePaused = safeAction(async function setPipelinePaused(
  paused: boolean,
): Promise<PipelineRunState> {
  await requireAuth();
  await setPaused(paused === true);
  return { paused: paused === true };
}, "Could not change the indexer state.");

// Queue every item that has no content row yet. The loop takes it from there.
export const indexEverything = safeAction(
  async function indexEverything(): Promise<{ queued: number }> {
    const queued = await withCurrentUser(async (tx, userId) => {
      const raw = await tx.execute(sql`
        INSERT INTO item_content (item_id, user_id, state, created_at, updated_at)
        SELECT i.id, i.user_id, 'pending', now(), now()
        FROM items i
        WHERE i.user_id = ${userId}
          AND NOT EXISTS (SELECT 1 FROM item_content ic WHERE ic.item_id = i.id)
        RETURNING item_id
      `);
      return Array.from(raw).length;
    });
    return { queued };
  },
  "Could not queue your items.",
);

/**
 * Retry the failures that can actually succeed on a second try.
 *
 * The filter comes from the reason metadata, not from the caller, so this
 * cannot regress into the button it replaced — one that requeued pages already
 * known to contain no article, reported "Requeued 10 items", and quietly
 * failed all of them again a minute later.
 */
export const retryFailedItems = safeAction(
  async function retryFailedItems(): Promise<{ queued: number }> {
    const retryable = FAILURE_REASON_VALUES.filter(
      (reason) => FAILURE_REASONS[reason].retryable,
    );
    const queued = await withCurrentUser((_tx, userId) =>
      requeueFailed(userId, retryable),
    );
    return { queued };
  },
  "Could not retry the failed items.",
);

/** Retry one specific reason — the per-group buttons in the failures list. */
export const retryFailureReason = safeAction(async function retryFailureReason(
  reason: FailureReason,
): Promise<{ queued: number }> {
  const queued = await withCurrentUser((_tx, userId) =>
    requeueFailed(userId, [reason]),
  );
  return { queued };
}, "Could not retry those items.");

/** Re-index from scratch: discards the stored text and re-fetches. */
export const reindexItems = safeAction(async function reindexItems(
  itemIds: string[],
): Promise<{ queued: number }> {
  const queued = await withCurrentUser((_tx, userId) =>
    requeueItems(userId, itemIds),
  );
  return { queued };
}, "Could not re-index those items.");

/**
 * Queue everything whose vector predates the current embedding model. Called
 * after a model switch — the text is kept, so this is embedding only.
 */
export const reembedForCurrentModel = safeAction(
  async function reembedForCurrentModel(): Promise<{ queued: number }> {
    await requireAuth();
    return { queued: await requeueStaleModel() };
  },
  "Could not queue the re-embedding.",
);
