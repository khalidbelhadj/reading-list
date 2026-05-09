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

export async function getDueCards(limit = 5): Promise<FlashcardWithItem[]> {
  parseInput(getDueCardsSchema, { limit });
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
      .limit(limit),
  );
}

export async function getNewCards(limit = 5): Promise<FlashcardWithItem[]> {
  parseInput(getNewCardsSchema, { limit });
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
      .limit(limit),
  );
}

export async function getCardsForItem(itemId: string): Promise<FlashcardWithItem[]> {
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
}

export async function getAllCardsForCram(): Promise<FlashcardWithItem[]> {
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
}

const interleaveByItem = <T extends { itemId: string | null; due: string }>(
  cards: T[],
): T[] => {
  const groups = new Map<string, T[]>();
  let solo = 0;
  for (const card of cards) {
    const key = card.itemId ?? `__solo__${solo++}`;
    const existing = groups.get(key);
    if (existing) existing.push(card);
    else groups.set(key, [card]);
  }
  const buckets = Array.from(groups.values());
  for (const bucket of buckets) {
    bucket.sort((a, b) => a.due.localeCompare(b.due));
  }

  const result: T[] = [];
  const maxLen = buckets.reduce((m, b) => Math.max(m, b.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of buckets) {
      if (i < bucket.length) result.push(bucket[i]);
    }
  }
  return result;
};

export async function startReviewSession(args: {
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

    if (args.mode === "due") {
      cards = await tx
        .select(cardSelection)
        .from(flashcards)
        .leftJoin(
          items,
          and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
        )
        .where(and(eq(flashcards.userId, userId), lte(flashcards.due, now)))
        .orderBy(asc(flashcards.due))
        .limit(limit);
    } else if (args.mode === "new") {
      cards = await tx
        .select(cardSelection)
        .from(flashcards)
        .leftJoin(
          items,
          and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
        )
        .where(and(eq(flashcards.userId, userId), eq(flashcards.state, "new")))
        .orderBy(asc(flashcards.createdAt))
        .limit(limit);
    } else if (args.mode === "item") {
      if (!args.scope?.itemId)
        throw new Error("item mode requires scope.itemId");
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
      cards = await tx
        .select(cardSelection)
        .from(flashcards)
        .leftJoin(
          items,
          and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
        )
        .where(eq(flashcards.userId, userId))
        .orderBy(asc(flashcards.createdAt))
        .limit(limit);
    }

    cards = interleaveByItem(cards);
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
}

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

export async function getReviewSession(
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
}

export type SessionSummary = {
  mode: string;
  totalCards: number;
  ratedCards: number;
  ratings: { again: number; hard: number; good: number; easy: number };
  totalActiveMs: number;
  wallClockMs: number;
  avgTimeToRevealMs: number | null;
};

export async function getSessionSummary(
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
}

export async function rateCard(args: {
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
    if (!session) throw new Error("Review session not found");
    if (session.endedAt) throw new Error("Review session already ended");

    const [card] = await tx
      .select()
      .from(flashcards)
      .where(
        and(eq(flashcards.id, args.flashcardId), eq(flashcards.userId, userId)),
      );
    if (!card) throw new Error("Flashcard not found");

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
}

export async function logSessionEvent(
  sessionId: string,
  event: ReviewEvent,
): Promise<void> {
  parseInput(logSessionEventSchema, { sessionId, event });
  const userId = await getCurrentUserId();
  await logReviewEvent(userId, sessionId, event);
}

export async function skipCard(args: {
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
}

export async function endReviewSession(args: {
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
    if (!session) throw new Error("Review session not found");
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
}

export async function getReviewStatus(): Promise<{
  dueCount: number;
  dueItemCount: number;
  newCount: number;
  newItemCount: number;
  totalCardCount: number;
  totalItemCount: number;
  lastReviewedAt: string | null;
}> {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  return withUser(userId, async (tx) => {
    const [dueRows, newRows, totalRows, lastRows] = await Promise.all([
      tx
        .select({
          cards: sql<number>`count(*)::int`,
          items: sql<number>`count(distinct ${flashcards.itemId})::int`,
        })
        .from(flashcards)
        .where(and(eq(flashcards.userId, userId), lte(flashcards.due, now))),
      tx
        .select({
          cards: sql<number>`count(*)::int`,
          items: sql<number>`count(distinct ${flashcards.itemId})::int`,
        })
        .from(flashcards)
        .where(
          and(eq(flashcards.userId, userId), eq(flashcards.state, "new")),
        ),
      tx
        .select({
          cards: sql<number>`count(*)::int`,
          items: sql<number>`count(distinct ${flashcards.itemId})::int`,
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
    return {
      dueCount: dueRows[0]?.cards ?? 0,
      dueItemCount: dueRows[0]?.items ?? 0,
      newCount: newRows[0]?.cards ?? 0,
      newItemCount: newRows[0]?.items ?? 0,
      totalCardCount: totalRows[0]?.cards ?? 0,
      totalItemCount: totalRows[0]?.items ?? 0,
      lastReviewedAt: lastRows[0]?.reviewedAt ?? null,
    };
  });
}
