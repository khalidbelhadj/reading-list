// Server-only implementations — see ./index.ts for the RPC layer.
import { desc, eq } from "drizzle-orm";

import { flashcards, items } from "@/db/schema";
import { flashcardItemJoin, withCurrentUser } from "@/lib/db-helpers.server";
import { updateFlashcards as updateFlashcardsLib } from "@/lib/flashcards.server";
import { time } from "@/lib/perf";
import { safeAction } from "@/lib/safe-action";
import { parseInput, updateFlashcardSchema } from "@/lib/schemas";

export const getAllFlashcards = safeAction(async function getAllFlashcards() {
  return time("action:getAllFlashcards", async () => {
    return withCurrentUser(
      (tx, userId) =>
        tx
          .select({
            id: flashcards.id,
            front: flashcards.front,
            back: flashcards.back,
            state: flashcards.state,
            due: flashcards.due,
            interval: flashcards.interval,
            easeFactor: flashcards.easeFactor,
            reps: flashcards.reps,
            lapses: flashcards.lapses,
            itemId: flashcards.itemId,
            itemTitle: items.title,
            itemUrl: items.url,
            itemFaviconUrl: items.faviconUrl,
            createdAt: flashcards.createdAt,
            updatedAt: flashcards.updatedAt,
          })
          .from(flashcards)
          .leftJoin(items, flashcardItemJoin(userId))
          .where(eq(flashcards.userId, userId))
          .orderBy(desc(flashcards.createdAt)),
      "getAllFlashcards",
    );
  });
}, "Could not load flashcards. Please try again.");

export const updateFlashcard = safeAction(async function updateFlashcard(
  id: string,
  fields: { front?: string; back?: string },
) {
  parseInput(updateFlashcardSchema, { id, fields });
  await withCurrentUser((tx, userId) =>
    updateFlashcardsLib(tx, userId, [{ id, ...fields }]),
  );
}, "Could not update flashcard. Please try again.");
