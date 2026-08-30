// Server-only implementation — see ./index.ts for the RPC layer.
//
// Reviews are ephemeral: the client derives its queue from the flashcards
// cache and rating a card is a single, self-contained scheduling update on
// the card's row. There is no session record and no event log.
import { and, eq } from "drizzle-orm";

import { flashcards } from "@/db/schema";
import { withCurrentUser } from "@/lib/db-helpers.server";
import { ActionError, safeAction } from "@/lib/safe-action";
import { parseInput, rateCardSchema } from "@/lib/schemas";
import { parseCardState, type Rating, schedule } from "@/lib/srs";

export const rateCard = safeAction(async function rateCard(args: {
  flashcardId: string;
  rating: Rating;
  // false for a cram run: stamps lastReviewedAt but never reschedules.
  affectsSchedule: boolean;
}): Promise<void> {
  parseInput(rateCardSchema, args);
  const now = new Date().toISOString();

  await withCurrentUser(async (tx, userId) => {
    const [card] = await tx
      .select({
        state: flashcards.state,
        interval: flashcards.interval,
        easeFactor: flashcards.easeFactor,
        reps: flashcards.reps,
        lapses: flashcards.lapses,
        due: flashcards.due,
      })
      .from(flashcards)
      .where(
        and(eq(flashcards.id, args.flashcardId), eq(flashcards.userId, userId)),
      );
    if (!card) throw new ActionError("Flashcard not found");

    if (!args.affectsSchedule) {
      // Cram: stamp lastReviewedAt only. updatedAt is deliberately untouched —
      // a cram pass isn't an edit and shouldn't reorder anything sorted by it.
      await tx
        .update(flashcards)
        .set({ lastReviewedAt: now })
        .where(
          and(
            eq(flashcards.id, args.flashcardId),
            eq(flashcards.userId, userId),
          ),
        );
      return;
    }

    const next = schedule(
      { ...card, state: parseCardState(card.state) },
      args.rating,
      now,
    );
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
        and(eq(flashcards.id, args.flashcardId), eq(flashcards.userId, userId)),
      );
  }, "rateCard");
}, "Could not rate card. Please try again.");
