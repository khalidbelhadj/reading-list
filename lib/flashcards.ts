import { db, type Tx } from "@/db";
import { items, flashcards } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type CreateFlashcardInput = {
  itemId: string;
  front: string;
  back: string;
};

export type CreatedFlashcard = {
  id: string;
  itemId: string;
  front: string;
  back: string;
  createdAt: string;
  updatedAt: string;
};

export const createFlashcards = async (
  tx: Tx | typeof db,
  userId: string,
  inputs: CreateFlashcardInput[],
): Promise<{ created: CreatedFlashcard[]; notFound: string[] }> => {
  const now = new Date().toISOString();
  const created: CreatedFlashcard[] = [];
  const notFound: string[] = [];

  for (const input of inputs) {
    const [owned] = await tx
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.id, input.itemId), eq(items.userId, userId)));
    if (!owned) {
      notFound.push(input.itemId);
      continue;
    }
    const id = crypto.randomUUID();
    await tx.insert(flashcards).values({
      id,
      userId,
      itemId: input.itemId,
      front: input.front,
      back: input.back,
      createdAt: now,
      updatedAt: now,
    });
    created.push({
      id,
      itemId: input.itemId,
      front: input.front,
      back: input.back,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { created, notFound };
};

export type UpdateFlashcardInput = {
  id: string;
  front?: string;
  back?: string;
};

export const updateFlashcards = async (
  tx: Tx | typeof db,
  userId: string,
  updates: UpdateFlashcardInput[],
): Promise<{ updated: number; notFound: string[] }> => {
  const now = new Date().toISOString();
  let updated = 0;
  const notFound: string[] = [];

  for (const update of updates) {
    const [owned] = await tx
      .select({ id: flashcards.id })
      .from(flashcards)
      .where(and(eq(flashcards.id, update.id), eq(flashcards.userId, userId)));
    if (!owned) {
      notFound.push(update.id);
      continue;
    }

    const set: Record<string, unknown> = { updatedAt: now };
    if (update.front !== undefined) set.front = update.front;
    if (update.back !== undefined) set.back = update.back;

    await tx
      .update(flashcards)
      .set(set)
      .where(and(eq(flashcards.id, update.id), eq(flashcards.userId, userId)));
    updated++;
  }

  return { updated, notFound };
};

export const deleteFlashcards = async (
  tx: Tx | typeof db,
  userId: string,
  ids: string[],
): Promise<{ deleted: number; notFound: string[] }> => {
  let deleted = 0;
  const notFound: string[] = [];

  for (const id of ids) {
    const [owned] = await tx
      .select({ id: flashcards.id })
      .from(flashcards)
      .where(and(eq(flashcards.id, id), eq(flashcards.userId, userId)));
    if (!owned) {
      notFound.push(id);
      continue;
    }

    await tx
      .delete(flashcards)
      .where(and(eq(flashcards.id, id), eq(flashcards.userId, userId)));
    deleted++;
  }

  return { deleted, notFound };
};
