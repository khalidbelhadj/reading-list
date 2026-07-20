// Server-only implementations — see ./index.ts for the RPC layer.
// Aggregate review reads (summaries and status counts); the session
// lifecycle lives in ./review-session.ts.
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { cardReviews, flashcards, items, reviewSessions } from "@/db/schema";
import { flashcardItemJoin, withCurrentUser } from "@/lib/db-helpers.server";
import { time } from "@/lib/perf";
import { safeAction } from "@/lib/safe-action";
import {
  getItemReviewStatusSchema,
  getSessionSummarySchema,
  parseInput,
} from "@/lib/schemas";

import {
  notHiddenFromReview,
  type ReviewMode,
  type ReviewScope,
} from "./review-session";

export type SessionSummary = {
  mode: ReviewMode;
  scope: ReviewScope | null;
  totalCards: number;
  ratedCards: number;
  ratings: { again: number; hard: number; good: number; easy: number };
  totalActiveMs: number;
  wallClockMs: number;
  avgTimeToRevealMs: number | null;
};

export const getSessionSummary = safeAction(async function getSessionSummary(
  sessionId: string,
): Promise<SessionSummary | null> {
  parseInput(getSessionSummarySchema, { sessionId });
  return withCurrentUser(async (tx, userId) => {
    const [session] = await tx
      .select()
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.id, sessionId),
          eq(reviewSessions.userId, userId),
        ),
      );
    if (!session) return null;

    const reviews = await tx
      .select({
        rating: cardReviews.rating,
        durationMs: cardReviews.durationMs,
        timeToRevealMs: cardReviews.timeToRevealMs,
      })
      .from(cardReviews)
      .where(
        and(
          eq(cardReviews.sessionId, sessionId),
          eq(cardReviews.userId, userId),
        ),
      );

    const ratings = { again: 0, hard: 0, good: 0, easy: 0 };
    let totalActiveMs = 0;
    let revealCount = 0;
    let revealSum = 0;

    for (const r of reviews) {
      if (r.rating === "again") ratings.again++;
      else if (r.rating === "hard") ratings.hard++;
      else if (r.rating === "good") ratings.good++;
      else if (r.rating === "easy") ratings.easy++;
      totalActiveMs += r.durationMs ?? 0;
      if (r.timeToRevealMs != null) {
        revealCount++;
        revealSum += r.timeToRevealMs;
      }
    }

    const endedAt = session.endedAt ?? new Date().toISOString();
    const wallClockMs =
      new Date(endedAt).getTime() - new Date(session.startedAt).getTime();

    return {
      mode: session.mode as ReviewMode,
      scope: z
        .object({
          itemId: z.string().optional(),
          tagIds: z.array(z.number()).optional(),
        })
        .nullable()
        .catch(null)
        .parse(session.scope ?? null),
      totalCards: z.array(z.string()).parse(session.cardIds ?? []).length,
      ratedCards: reviews.length,
      ratings,
      totalActiveMs,
      wallClockMs,
      avgTimeToRevealMs:
        revealCount > 0 ? Math.round(revealSum / revealCount) : null,
    };
  });
}, "Could not load session summary. Please try again.");

export type ItemReviewStatus = {
  dueCount: number;
  newCount: number;
  totalCardCount: number;
};

export const getItemReviewStatus = safeAction(
  async function getItemReviewStatus(
    itemId: string,
  ): Promise<ItemReviewStatus> {
    parseInput(getItemReviewStatusSchema, { itemId });
    const now = new Date().toISOString();
    return withCurrentUser(async (tx, userId) => {
      const [counts] = await tx
        .select({
          dueCards: sql<number>`count(*) filter (where ${flashcards.due} <= ${now})::int`,
          newCards: sql<number>`count(*) filter (where ${flashcards.state} = 'new')::int`,
          totalCards: sql<number>`count(*)::int`,
        })
        .from(flashcards)
        .where(
          and(eq(flashcards.userId, userId), eq(flashcards.itemId, itemId)),
        );
      return {
        dueCount: counts?.dueCards ?? 0,
        newCount: counts?.newCards ?? 0,
        totalCardCount: counts?.totalCards ?? 0,
      };
    }, "getItemReviewStatus");
  },
  "Could not load review status for this item. Please try again.",
);

export const getReviewStatus = safeAction(
  async function getReviewStatus(): Promise<{
    dueCount: number;
    dueItemCount: number;
    newCount: number;
    newItemCount: number;
    totalCardCount: number;
    totalItemCount: number;
    lastReviewedAt: string | null;
  }> {
    return time("action:getReviewStatus", async () => {
      const now = new Date().toISOString();
      return withCurrentUser(async (tx, userId) => {
        // Single aggregate scan over flashcards (3 conditional COUNTs in one pass)
        // plus the latest cardReviews row, in parallel — replaces 4 separate
        // queries that each ate ~150ms of withUser overhead end-to-end.
        const [counts, lastRows] = await Promise.all([
          tx
            .select({
              dueCards: sql<number>`count(*) filter (where ${flashcards.due} <= ${now})::int`,
              dueItems: sql<number>`count(distinct ${flashcards.itemId}) filter (where ${flashcards.due} <= ${now})::int`,
              newCards: sql<number>`count(*) filter (where ${flashcards.state} = 'new')::int`,
              newItems: sql<number>`count(distinct ${flashcards.itemId}) filter (where ${flashcards.state} = 'new')::int`,
              totalCards: sql<number>`count(*)::int`,
              totalItems: sql<number>`count(distinct ${flashcards.itemId})::int`,
            })
            .from(flashcards)
            .leftJoin(items, flashcardItemJoin(userId))
            .where(and(eq(flashcards.userId, userId), notHiddenFromReview)),
          tx
            .select({ reviewedAt: cardReviews.reviewedAt })
            .from(cardReviews)
            .where(eq(cardReviews.userId, userId))
            .orderBy(desc(cardReviews.reviewedAt))
            .limit(1),
        ]);
        const c = counts[0];
        return {
          dueCount: c?.dueCards ?? 0,
          dueItemCount: c?.dueItems ?? 0,
          newCount: c?.newCards ?? 0,
          newItemCount: c?.newItems ?? 0,
          totalCardCount: c?.totalCards ?? 0,
          totalItemCount: c?.totalItems ?? 0,
          lastReviewedAt: lastRows[0]?.reviewedAt ?? null,
        };
      }, "getReviewStatus");
    });
  },
  "Could not load review status. Please try again.",
);
