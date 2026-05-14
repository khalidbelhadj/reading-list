"use server";

import { withUser } from "@/db";
import {
  items,
  flashcards,
  reviewSessions,
  cardReviews,
} from "@/db/schema";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { safeAction, ActionError } from "@/lib/safe-action";
import { schedule, parseCardState, type Rating } from "@/lib/srs";
import { z } from "zod";
import { logReviewEvent, type ReviewEvent } from "@/lib/review-events";
import {
  parseInput,
  startReviewSessionSchema,
  rateCardSchema,
  skipCardSchema,
  endReviewSessionSchema,
  logSessionEventSchema,
  getReviewSessionSchema,
  getSessionSummarySchema,
  getDueCardsSchema,
  getNewCardsSchema,
  getCardsForItemSchema,
} from "@/lib/schemas";
import { time } from "@/lib/perf";

export type ReviewMode = "due" | "cram" | "item" | "new" | "filter";

export type ReviewScope = {
  itemId?: string;
  tagIds?: number[];
};

export type FlashcardWithItem = {
  id: string;
  itemId: string | null;
  front: string;
  back: string;
  state: string;
  due: string;
  interval: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  itemTitle: string | null;
  itemUrl: string | null;
  itemFaviconUrl: string | null;
};

const selectQueueCard = {
  id: flashcards.id,
  itemId: flashcards.itemId,
  front: flashcards.front,
  back: flashcards.back,
  state: flashcards.state,
  due: flashcards.due,
  interval: flashcards.interval,
  easeFactor: flashcards.easeFactor,
  reps: flashcards.reps,
  lapses: flashcards.lapses,
  itemTitle: items.title,
  itemUrl: items.url,
  itemFaviconUrl: items.faviconUrl,
};

export const getDueCards = safeAction(async function getDueCards(limit?: number): Promise<FlashcardWithItem[]> {
  return time("action:getDueCards", async () => {
  const n = limit ?? 5;
  parseInput(getDueCardsSchema, { limit: n });
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  return withUser(userId, (tx) =>
    tx
      .select(selectQueueCard)
      .from(flashcards)
      .leftJoin(
        items,
        and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
      )
      .where(and(eq(flashcards.userId, userId), lte(flashcards.due, now)))
      .orderBy(asc(flashcards.due))
      .limit(n),
    "getDueCards",
  );
  });
}, "Could not load due cards. Please try again.");

export const getNewCards = safeAction(async function getNewCards(limit?: number): Promise<FlashcardWithItem[]> {
  return time("action:getNewCards", async () => {
  const n = limit ?? 5;
  parseInput(getNewCardsSchema, { limit: n });
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx
      .select(selectQueueCard)
      .from(flashcards)
      .leftJoin(
        items,
        and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
      )
      .where(and(eq(flashcards.userId, userId), eq(flashcards.state, "new")))
      .orderBy(asc(flashcards.createdAt))
      .limit(n),
    "getNewCards",
  );
  });
}, "Could not load new cards. Please try again.");

export const getCardsForItem = safeAction(async function getCardsForItem(itemId: string): Promise<FlashcardWithItem[]> {
  parseInput(getCardsForItemSchema, { itemId });
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx
      .select(selectQueueCard)
      .from(flashcards)
      .leftJoin(
        items,
        and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
      )
      .where(and(eq(flashcards.userId, userId), eq(flashcards.itemId, itemId)))
      .orderBy(asc(flashcards.createdAt)),
  );
}, "Could not load cards for item. Please try again.");

export const getAllCardsForCram = safeAction(async function getAllCardsForCram(): Promise<FlashcardWithItem[]> {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx
      .select(selectQueueCard)
      .from(flashcards)
      .leftJoin(
        items,
        and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
      )
      .where(eq(flashcards.userId, userId))
      .orderBy(asc(flashcards.createdAt)),
  );
}, "Could not load cards for cram. Please try again.");

const shuffle = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const shuffleWithSiblingSpacing = <T extends { itemId: string | null }>(
  cards: T[],
): T[] => {
  shuffle(cards);

  for (let i = 1; i < cards.length; i++) {
    if (
      cards[i].itemId !== null &&
      cards[i].itemId === cards[i - 1].itemId
    ) {
      let swapped = false;
      for (let j = i + 1; j < cards.length; j++) {
        if (cards[j].itemId !== cards[i].itemId) {
          [cards[i], cards[j]] = [cards[j], cards[i]];
          swapped = true;
          break;
        }
      }
      if (!swapped) break;
    }
  }

  return cards;
};

const weightedRandomSelection = <T>(
  pool: T[],
  weights: number[],
  count: number,
): T[] => {
  const selected: T[] = [];
  const remainingIndices = pool.map((_, i) => i);
  const remainingWeights = [...weights];

  const actualCount = Math.min(count, pool.length);
  for (let pick = 0; pick < actualCount; pick++) {
    let totalWeight = 0;
    for (const weight of remainingWeights) totalWeight += weight;

    let random = Math.random() * totalWeight;
    let chosenIdx = 0;
    for (let i = 0; i < remainingWeights.length; i++) {
      random -= remainingWeights[i];
      if (random <= 0) {
        chosenIdx = i;
        break;
      }
    }

    selected.push(pool[remainingIndices[chosenIdx]]);
    remainingIndices.splice(chosenIdx, 1);
    remainingWeights.splice(chosenIdx, 1);
  }

  return selected;
};

export const startReviewSession = safeAction(async function startReviewSession(args: {
  mode: ReviewMode;
  scope?: ReviewScope;
  limit?: number;
}): Promise<{
  sessionId: string;
  cardCount: number;
  data: ReviewSessionData | null;
}> {
  parseInput(startReviewSessionSchema, args);
  const userId = await getCurrentUserId();
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const affectsSchedule = args.mode !== "cram";
  const limit = args.limit ?? 5;

  return withUser(userId, async (tx) => {
    const cardSelection = selectQueueCard;

    let cards: ReviewSessionCard[] = [];

    const poolSize = limit * 3;

    if (args.mode === "due") {
      const pool = await tx
        .select(cardSelection)
        .from(flashcards)
        .leftJoin(
          items,
          and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
        )
        .where(and(eq(flashcards.userId, userId), lte(flashcards.due, now)))
        .orderBy(asc(flashcards.due))
        .limit(poolSize);

      const nowMs = Date.now();
      const weights = pool.map((card) => {
        const overdueMs = nowMs - new Date(card.due).getTime();
        return Math.max(overdueMs, 1);
      });
      cards = weightedRandomSelection(pool, weights, limit);
    } else if (args.mode === "new") {
      const pool = await tx
        .select(cardSelection)
        .from(flashcards)
        .leftJoin(
          items,
          and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
        )
        .where(and(eq(flashcards.userId, userId), eq(flashcards.state, "new")))
        .orderBy(asc(flashcards.createdAt))
        .limit(poolSize);

      const uniformWeights = pool.map(() => 1);
      cards = weightedRandomSelection(pool, uniformWeights, limit);
    } else if (args.mode === "item") {
      if (!args.scope?.itemId)
        throw new ActionError("Item mode requires an item ID");
      cards = await tx
        .select(cardSelection)
        .from(flashcards)
        .leftJoin(
          items,
          and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
        )
        .where(
          and(
            eq(flashcards.userId, userId),
            eq(flashcards.itemId, args.scope.itemId),
          ),
        )
        .orderBy(asc(flashcards.createdAt));
    } else if (args.mode === "cram") {
      const pool = await tx
        .select(cardSelection)
        .from(flashcards)
        .leftJoin(
          items,
          and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
        )
        .where(eq(flashcards.userId, userId))
        .orderBy(asc(flashcards.createdAt))
        .limit(poolSize);

      const uniformWeights = pool.map(() => 1);
      cards = weightedRandomSelection(pool, uniformWeights, limit);
    }

    cards = shuffleWithSiblingSpacing(cards);
    const cardIds = cards.map((c) => c.id);

    await tx.insert(reviewSessions).values({
      id: sessionId,
      userId,
      mode: args.mode,
      scope: args.scope ?? null,
      cardIds,
      cardsPlanned: cardIds.length,
      cardsCompleted: 0,
      affectsSchedule,
      startedAt: now,
    });

    const data: ReviewSessionData | null = cardIds.length
      ? {
          session: {
            id: sessionId,
            mode: args.mode,
            cardsPlanned: cardIds.length,
            cardsCompleted: 0,
            affectsSchedule,
            startedAt: now,
            endedAt: null,
          },
          cards,
          completedCardIds: [],
        }
      : null;

    return { sessionId, cardCount: cardIds.length, data };
  });
}, "Could not start review session. Please try again.");

export type ReviewSessionCard = FlashcardWithItem;

export type ReviewSessionData = {
  session: {
    id: string;
    mode: string;
    cardsPlanned: number;
    cardsCompleted: number;
    affectsSchedule: boolean;
    startedAt: string;
    endedAt: string | null;
  };
  cards: ReviewSessionCard[];
  completedCardIds: string[];
};

export const getReviewSession = safeAction(async function getReviewSession(
  sessionId: string,
): Promise<ReviewSessionData | null> {
  parseInput(getReviewSessionSchema, { sessionId });
  const userId = await getCurrentUserId();
  return withUser(userId, async (tx) => {
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

    const ids = z.array(z.string()).parse(session.cardIds ?? []);
    const cards: ReviewSessionCard[] = ids.length
      ? await tx
          .select(selectQueueCard)
          .from(flashcards)
          .leftJoin(
            items,
            and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
          )
          .where(
            and(eq(flashcards.userId, userId), inArray(flashcards.id, ids)),
          )
      : [];

    const cardsById = new Map(cards.map((c) => [c.id, c]));
    const orderedCards = ids
      .map((id) => cardsById.get(id))
      .filter((c): c is ReviewSessionCard => Boolean(c));

    const completed = await tx
      .select({ flashcardId: cardReviews.flashcardId })
      .from(cardReviews)
      .where(
        and(
          eq(cardReviews.sessionId, sessionId),
          eq(cardReviews.userId, userId),
        ),
      )
      .orderBy(asc(cardReviews.reviewedAt));

    return {
      session: {
        id: session.id,
        mode: session.mode,
        cardsPlanned: session.cardsPlanned,
        cardsCompleted: session.cardsCompleted,
        affectsSchedule: session.affectsSchedule,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      },
      cards: orderedCards,
      completedCardIds: completed.map((c) => c.flashcardId),
    };
  });
}, "Could not load review session. Please try again.");

export type SessionSummary = {
  mode: string;
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
  const userId = await getCurrentUserId();
  return withUser(userId, async (tx) => {
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
      mode: session.mode,
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

export const rateCard = safeAction(async function rateCard(args: {
  sessionId: string;
  flashcardId: string;
  rating: Rating;
  durationMs: number;
  timeToRevealMs: number | null;
}): Promise<void> {
  parseInput(rateCardSchema, args);
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();

  await withUser(userId, async (tx) => {
    const [session] = await tx
      .select({
        id: reviewSessions.id,
        affectsSchedule: reviewSessions.affectsSchedule,
        endedAt: reviewSessions.endedAt,
      })
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.id, args.sessionId),
          eq(reviewSessions.userId, userId),
        ),
      );
    if (!session) throw new ActionError("Review session not found");
    if (session.endedAt) throw new ActionError("Review session already ended");

    const [card] = await tx
      .select()
      .from(flashcards)
      .where(
        and(eq(flashcards.id, args.flashcardId), eq(flashcards.userId, userId)),
      );
    if (!card) throw new ActionError("Flashcard not found");

    const next = schedule(
      {
        state: parseCardState(card.state),
        interval: card.interval,
        easeFactor: card.easeFactor,
        reps: card.reps,
        lapses: card.lapses,
        due: card.due,
      },
      args.rating,
      now,
    );

    await tx.insert(cardReviews).values({
      id: crypto.randomUUID(),
      userId,
      sessionId: args.sessionId,
      flashcardId: args.flashcardId,
      rating: args.rating,
      durationMs: args.durationMs,
      timeToRevealMs: args.timeToRevealMs,
      prevState: card.state,
      prevInterval: card.interval,
      prevEaseFactor: card.easeFactor,
      prevReps: card.reps,
      nextState: session.affectsSchedule ? next.state : card.state,
      nextInterval: session.affectsSchedule ? next.interval : card.interval,
      nextEaseFactor: session.affectsSchedule
        ? next.easeFactor
        : card.easeFactor,
      nextDue: session.affectsSchedule ? next.due : card.due,
      reviewedAt: now,
    });

    if (session.affectsSchedule) {
      await tx
        .update(flashcards)
        .set({
          state: next.state,
          interval: next.interval,
          easeFactor: next.easeFactor,
          reps: next.reps,
          lapses: next.lapses,
          due: next.due,
          lastReviewedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(flashcards.id, args.flashcardId),
            eq(flashcards.userId, userId),
          ),
        );
    } else {
      await tx
        .update(flashcards)
        .set({ lastReviewedAt: now })
        .where(
          and(
            eq(flashcards.id, args.flashcardId),
            eq(flashcards.userId, userId),
          ),
        );
    }

    await tx
      .update(reviewSessions)
      .set({ cardsCompleted: sql`${reviewSessions.cardsCompleted} + 1` })
      .where(eq(reviewSessions.id, args.sessionId));
  });
}, "Could not rate card. Please try again.");

export const logSessionEvent = safeAction(async function logSessionEvent(
  sessionId: string,
  event: ReviewEvent,
): Promise<void> {
  parseInput(logSessionEventSchema, { sessionId, event });
  const userId = await getCurrentUserId();
  await logReviewEvent(userId, sessionId, event);
}, "Could not log review event. Please try again.");

export const skipCard = safeAction(async function skipCard(args: {
  sessionId: string;
  flashcardId: string;
  afterReveal: boolean;
  durationMs: number;
}): Promise<void> {
  parseInput(skipCardSchema, args);
  const userId = await getCurrentUserId();
  await logReviewEvent(userId, args.sessionId, {
    type: "card_skipped",
    flashcardId: args.flashcardId,
    data: { afterReveal: args.afterReveal, durationMs: args.durationMs },
  });
}, "Could not skip card. Please try again.");

export const endReviewSession = safeAction(async function endReviewSession(args: {
  sessionId: string;
  reason: "completed" | "user_ended";
}): Promise<void> {
  parseInput(endReviewSessionSchema, args);
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();

  await withUser(userId, async (tx) => {
    const [session] = await tx
      .select({ endedAt: reviewSessions.endedAt })
      .from(reviewSessions)
      .where(
        and(
          eq(reviewSessions.id, args.sessionId),
          eq(reviewSessions.userId, userId),
        ),
      );
    if (!session) throw new ActionError("Review session not found");
    if (session.endedAt) return;

    await tx
      .update(reviewSessions)
      .set({ endedAt: now })
      .where(
        and(
          eq(reviewSessions.id, args.sessionId),
          eq(reviewSessions.userId, userId),
        ),
      );
  });

  await logReviewEvent(userId, args.sessionId, {
    type: "session_ended",
    flashcardId: null,
    data: { reason: args.reason },
  });
}, "Could not end review session. Please try again.");

export const getReviewStatus = safeAction(async function getReviewStatus(): Promise<{
  dueCount: number;
  dueItemCount: number;
  newCount: number;
  newItemCount: number;
  totalCardCount: number;
  totalItemCount: number;
  lastReviewedAt: string | null;
}> {
  return time("action:getReviewStatus", async () => {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  return withUser(userId, async (tx) => {
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
        .where(eq(flashcards.userId, userId)),
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
}, "Could not load review status. Please try again.");
