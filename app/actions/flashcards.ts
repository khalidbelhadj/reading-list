// Server-only implementations — see ./index.ts for the RPC layer.
import { and, desc, eq } from "drizzle-orm";

import { flashcards, items } from "@/db/schema";
import { flashcardItemJoin, withCurrentUser } from "@/lib/db-helpers.server";
import {
  createFlashcards as createFlashcardsLib,
  deleteFlashcards as deleteFlashcardsLib,
  updateFlashcards as updateFlashcardsLib,
} from "@/lib/flashcards.server";
import { time } from "@/lib/perf";
import { ActionError, safeAction } from "@/lib/safe-action";
import {
  createFlashcardSchema,
  deleteFlashcardSchema,
  getFlashcardsSchema,
  parseInput,
  updateFlashcardSchema,
} from "@/lib/schemas";

export const getFlashcards = safeAction(async function getFlashcards(
  itemId: string,
) {
  return time(
    "action:getFlashcards",
    async () => {
      parseInput(getFlashcardsSchema, { itemId });
      return withCurrentUser(
        (tx, userId) =>
          tx
            .select()
            .from(flashcards)
            .where(
              and(eq(flashcards.itemId, itemId), eq(flashcards.userId, userId)),
            )
            .orderBy(desc(flashcards.createdAt)),
        "getFlashcards",
      );
    },
    { itemId },
  );
}, "Could not load flashcards. Please try again.");

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

export const createFlashcard = safeAction(async function createFlashcard(
  itemId: string,
  front: string,
  back: string,
) {
  parseInput(createFlashcardSchema, { itemId, front, back });
  return withCurrentUser(async (tx, userId) => {
    const result = await createFlashcardsLib(tx, userId, [
      { itemId, front, back },
    ]);
    if (result.notFound.length > 0) throw new ActionError("Item not found");
    return result.created[0];
  });
}, "Could not create flashcard. Please try again.");

export const updateFlashcard = safeAction(async function updateFlashcard(
  id: string,
  fields: { front?: string; back?: string },
) {
  parseInput(updateFlashcardSchema, { id, fields });
  await withCurrentUser((tx, userId) =>
    updateFlashcardsLib(tx, userId, [{ id, ...fields }]),
  );
}, "Could not update flashcard. Please try again.");

export const deleteFlashcard = safeAction(async function deleteFlashcard(
  id: string,
) {
  parseInput(deleteFlashcardSchema, { id });
  await withCurrentUser((tx, userId) => deleteFlashcardsLib(tx, userId, [id]));
}, "Could not delete flashcard. Please try again.");
