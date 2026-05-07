"use server";

import { withUser } from "@/db";
import { flashcards, items } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
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

export async function getFlashcards(itemId: string) {
  parseInput(getFlashcardsSchema, { itemId });
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) =>
    tx
      .select()
      .from(flashcards)
      .where(and(eq(flashcards.itemId, itemId), eq(flashcards.userId, userId)))
      .orderBy(desc(flashcards.createdAt)),
  );
}

export async function getAllFlashcards() {
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
}

export async function createFlashcard(
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
    if (result.notFound.length > 0) throw new Error("Item not found");
    return result.created[0];
  });
}

export async function updateFlashcard(
  id: string,
  fields: { front?: string; back?: string },
) {
  parseInput(updateFlashcardSchema, { id, fields });
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) =>
    updateFlashcardsLib(tx, userId, [{ id, ...fields }]),
  );
}

export async function deleteFlashcard(id: string) {
  parseInput(deleteFlashcardSchema, { id });
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) => deleteFlashcardsLib(tx, userId, [id]));
}
