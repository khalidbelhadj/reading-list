// Server-only implementations — see ./index.ts for the RPC layer.
import { withUser } from "@/db";
import {
  items,
  flashcards,
  reviewSessions,
  cardReviews,
  reviewEvents,
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
  getItemReviewStatusSchema,
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

export const getDueCards = safeAction(async function getDueCards(
  limit?: number,
): Promise<FlashcardWithItem[]> {
  return time("action:getDueCards", async () => {
    const n = limit ?? 5;
    parseInput(getDueCardsSchema, { limit: n });
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();
    return withUser(
      userId,
      (tx) =>
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

export const getNewCards = safeAction(async function getNewCards(
  limit?: number,
): Promise<FlashcardWithItem[]> {
  return time("action:getNewCards", async () => {
    const n = limit ?? 5;
    parseInput(getNewCardsSchema, { limit: n });
    const userId = await getCurrentUserId();
    return withUser(
      userId,
      (tx) =>
        tx
          .select(selectQueueCard)
          .from(flashcards)
          .leftJoin(
            items,
            and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
          )
          .where(
            and(eq(flashcards.userId, userId), eq(flashcards.state, "new")),
          )
          .orderBy(asc(flashcards.createdAt))
          .limit(n),
      "getNewCards",
    );
  });
}, "Could not load new cards. Please try again.");

export const getCardsForItem = safeAction(async function getCardsForItem(
  itemId: string,
): Promise<FlashcardWithItem[]> {
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

export const getAllCardsForCram = safeAction(
  async function getAllCardsForCram(): Promise<FlashcardWithItem[]> {
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
  },
  "Could not load cards for cram. Please try again.",
);

const shuffle = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = array[i];
    const b = array[j];
    if (a === undefined || b === undefined) continue;
    array[i] = b;
    array[j] = a;
  }
  return array;
};

const shuffleWithSiblingSpacing = <T extends { itemId: string | null }>(
  cards: T[],
): T[] => {
  shuffle(cards);

  for (let i = 1; i < cards.length; i++) {
    const current = cards[i];
    const previous = cards[i - 1];
    if (current === undefined || previous === undefined) continue;
    if (current.itemId !== null && current.itemId === previous.itemId) {
      let swapped = false;
      for (let j = i + 1; j < cards.length; j++) {
        const candidate = cards[j];
        if (candidate === undefined) continue;
        if (candidate.itemId !== current.itemId) {
          cards[i] = candidate;
          cards[j] = current;
          swapped = true;
          break;
        }
      }
      if (!swapped) break;
    }
  }

  return cards;
};

export const startReviewSession = safeAction(
  async function startReviewSession(args: {
    mode: ReviewMode;
    scope?: ReviewScope;
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

    return withUser(userId, async (tx) => {
      const cardSelection = selectQueueCard;

      let cards: ReviewSessionCard[] = [];

      // Optional item scoping: "due" / "new" / "cram" keep their semantics
      // (including affectsSchedule) but draw only from the scoped item's cards.
      const scopeFilter = args.scope?.itemId
        ? eq(flashcards.itemId, args.scope.itemId)
        : undefined;

      // Sessions target every matching card — no cap. The final
      // shuffleWithSiblingSpacing decides presentation order.
      if (args.mode === "due") {
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
              lte(flashcards.due, now),
              scopeFilter,
            ),
          )
          .orderBy(asc(flashcards.due));
      } else if (args.mode === "new") {
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
              eq(flashcards.state, "new"),
              scopeFilter,
            ),
          )
          .orderBy(asc(flashcards.createdAt));
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
        cards = await tx
          .select(cardSelection)
          .from(flashcards)
          .leftJoin(
            items,
            and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
          )
          .where(and(eq(flashcards.userId, userId), scopeFilter))
          .orderBy(asc(flashcards.createdAt));
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
  },
  "Could not start review session. Please try again.",
);

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

// Telemetry events (card_shown / answer_revealed) the client batches into the
// next rateCard / endReviewSession call rather than sending one action each.
export type BatchedReviewEvent = Extract<
  ReviewEvent,
  { type: "card_shown" | "answer_revealed" }
>;

const batchedEventsJson = (events: BatchedReviewEvent[] | undefined): string =>
  JSON.stringify(
    (events ?? []).map((e) => ({
      flashcard_id: e.flashcardId,
      type: e.type,
      data: e.data,
    })),
  );

export const rateCard = safeAction(async function rateCard(args: {
  sessionId: string;
  flashcardId: string;
  rating: Rating;
  durationMs: number;
  timeToRevealMs: number | null;
  events?: BatchedReviewEvent[];
}): Promise<void> {
  parseInput(rateCardSchema, args);
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();

  await withUser(
    userId,
    async (tx) => {
      // One round trip for both reads: the card is cross-joined onto the
      // session row (join condition doesn't reference the session), so a
      // missing card comes back as null card columns rather than no row.
      const [row] = await tx
        .select({
          affectsSchedule: reviewSessions.affectsSchedule,
          endedAt: reviewSessions.endedAt,
          cardId: flashcards.id,
          cardState: flashcards.state,
          cardInterval: flashcards.interval,
          cardEaseFactor: flashcards.easeFactor,
          cardReps: flashcards.reps,
          cardLapses: flashcards.lapses,
          cardDue: flashcards.due,
        })
        .from(reviewSessions)
        .leftJoin(
          flashcards,
          and(
            eq(flashcards.id, args.flashcardId),
            eq(flashcards.userId, userId),
          ),
        )
        .where(
          and(
            eq(reviewSessions.id, args.sessionId),
            eq(reviewSessions.userId, userId),
          ),
        );
      if (!row) throw new ActionError("Review session not found");
      if (row.endedAt) throw new ActionError("Review session already ended");
      if (
        row.cardId === null ||
        row.cardState === null ||
        row.cardInterval === null ||
        row.cardEaseFactor === null ||
        row.cardReps === null ||
        row.cardLapses === null ||
        row.cardDue === null
      ) {
        throw new ActionError("Flashcard not found");
      }

      const next = schedule(
        {
          state: parseCardState(row.cardState),
          interval: row.cardInterval,
          easeFactor: row.cardEaseFactor,
          reps: row.cardReps,
          lapses: row.cardLapses,
          due: row.cardDue,
        },
        args.rating,
        now,
      );

      const affects = row.affectsSchedule;
      // Schedule-affecting sessions write the new SRS state; cram sessions
      // only stamp lastReviewedAt (updatedAt intentionally untouched).
      const cardSet = affects
        ? sql`"state" = ${next.state}, "interval" = ${next.interval}, "ease_factor" = ${next.easeFactor}, "reps" = ${next.reps}, "lapses" = ${next.lapses}, "due" = ${next.due}, "last_reviewed_at" = ${now}, "updated_at" = ${now}`
        : sql`"last_reviewed_at" = ${now}`;

      // One round trip for all the writes (batched telemetry events included).
      // Each statement in the CTE is still RLS-checked individually under the
      // withUser context.
      await tx.execute(sql`
        WITH review_insert AS (
          INSERT INTO card_reviews (
            id, user_id, session_id, flashcard_id, rating, duration_ms,
            time_to_reveal_ms, prev_state, prev_interval, prev_ease_factor,
            prev_reps, next_state, next_interval, next_ease_factor, next_due,
            reviewed_at
          ) VALUES (
            ${crypto.randomUUID()}, ${userId}, ${args.sessionId},
            ${args.flashcardId}, ${args.rating}, ${args.durationMs},
            ${args.timeToRevealMs}, ${row.cardState}, ${row.cardInterval},
            ${row.cardEaseFactor}, ${row.cardReps},
            ${affects ? next.state : row.cardState},
            ${affects ? next.interval : row.cardInterval},
            ${affects ? next.easeFactor : row.cardEaseFactor},
            ${affects ? next.due : row.cardDue}, ${now}
          )
        ),
        card_update AS (
          UPDATE flashcards SET ${cardSet}
          WHERE "id" = ${args.flashcardId} AND "user_id" = ${userId}
        ),
        events_insert AS (
          INSERT INTO review_events (user_id, session_id, flashcard_id, type, data, created_at)
          SELECT ${userId}, ${args.sessionId}, e.flashcard_id, e.type, e.data, ${now}::timestamptz
          FROM jsonb_to_recordset(${batchedEventsJson(args.events)}::jsonb)
            AS e(flashcard_id text, type text, data jsonb)
        )
        UPDATE review_sessions SET "cards_completed" = "cards_completed" + 1
        WHERE "id" = ${args.sessionId} AND "user_id" = ${userId}
      `);
    },
    "rateCard",
  );
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

export const endReviewSession = safeAction(
  async function endReviewSession(args: {
    sessionId: string;
    reason: "completed" | "user_ended";
    events?: BatchedReviewEvent[];
  }): Promise<void> {
    parseInput(endReviewSessionSchema, args);
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();

    // Single transaction: stamp endedAt (no-op if already ended) and log the
    // session_ended event. The UPDATE's RETURNING doubles as the existence
    // check on the fast path; the extra SELECT only runs when nothing was
    // updated, to distinguish "already ended" from "not found".
    await withUser(
      userId,
      async (tx) => {
        const [updated] = await tx
          .update(reviewSessions)
          .set({ endedAt: now })
          .where(
            and(
              eq(reviewSessions.id, args.sessionId),
              eq(reviewSessions.userId, userId),
              sql`${reviewSessions.endedAt} IS NULL`,
            ),
          )
          .returning({ id: reviewSessions.id });

        if (!updated) {
          const [session] = await tx
            .select({ id: reviewSessions.id })
            .from(reviewSessions)
            .where(
              and(
                eq(reviewSessions.id, args.sessionId),
                eq(reviewSessions.userId, userId),
              ),
            );
          if (!session) throw new ActionError("Review session not found");
        }

        await tx.insert(reviewEvents).values([
          ...(args.events ?? []).map((e) => ({
            userId,
            sessionId: args.sessionId,
            flashcardId: e.flashcardId,
            type: e.type,
            data: e.data,
            createdAt: now,
          })),
          {
            userId,
            sessionId: args.sessionId,
            flashcardId: null,
            type: "session_ended",
            data: { reason: args.reason },
            createdAt: now,
          },
        ]);
      },
      "endReviewSession",
    );
  },
  "Could not end review session. Please try again.",
);

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
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();
    return withUser(
      userId,
      async (tx) => {
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
      },
      "getItemReviewStatus",
    );
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
      const userId = await getCurrentUserId();
      const now = new Date().toISOString();
      return withUser(
        userId,
        async (tx) => {
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
        },
        "getReviewStatus",
      );
    });
  },
  "Could not load review status. Please try again.",
);
