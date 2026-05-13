"use server";

import { withUser } from "@/db";
import { flashcards, items } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { safeAction, ActionError } from "@/lib/safe-action";
import {
  createFlashcards as createFlashcardsLib,
  updateFlashcards as updateFlashcardsLib,
  deleteFlashcards as deleteFlashcardsLib,
} from "@/lib/flashcards";
import {
  parseInput,
  getFlashcardsSchema,
  createFlashcardSchema,
  updateFlashcardSchema,
  deleteFlashcardSchema,
} from "@/lib/schemas";

export const getFlashcards = safeAction(async function getFlashcards(itemId: string) {
  parseInput(getFlashcardsSchema, { itemId });
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx
      .select()
      .from(flashcards)
      .where(and(eq(flashcards.itemId, itemId), eq(flashcards.userId, userId)))
      .orderBy(desc(flashcards.createdAt)),
  );
}, "Could not load flashcards. Please try again.");

export const getAllFlashcards = safeAction(async function getAllFlashcards() {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
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
      .leftJoin(
        items,
        and(eq(flashcards.itemId, items.id), eq(items.userId, userId)),
      )
      .where(eq(flashcards.userId, userId))
      .orderBy(desc(flashcards.createdAt)),
  );
}, "Could not load flashcards. Please try again.");

export const createFlashcard = safeAction(async function createFlashcard(
  itemId: string,
  front: string,
  back: string,
) {
  parseInput(createFlashcardSchema, { itemId, front, back });
  const userId = await getCurrentUserId();
  return withUser(userId, async (tx) => {
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
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) =>
    updateFlashcardsLib(tx, userId, [{ id, ...fields }]),
  );
}, "Could not update flashcard. Please try again.");

export const deleteFlashcard = safeAction(async function deleteFlashcard(id: string) {
  parseInput(deleteFlashcardSchema, { id });
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) => deleteFlashcardsLib(tx, userId, [id]));
}, "Could not delete flashcard. Please try again.");
