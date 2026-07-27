import { and, eq, inArray } from "drizzle-orm";

import { type db, type Tx } from "@/db";
import { flashcards, items } from "@/db/schema";

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
  if (inputs.length === 0) return { created: [], notFound: [] };

  const now = new Date().toISOString();
  const inputItemIds = Array.from(new Set(inputs.map((i) => i.itemId)));

  const ownedRows = await tx
    .select({ id: items.id })
    .from(items)
    .where(and(inArray(items.id, inputItemIds), eq(items.userId, userId)));
  const ownedIds = new Set(ownedRows.map((r) => r.id));

  const created: CreatedFlashcard[] = [];
  const notFound: string[] = [];
  const toInsert: (typeof flashcards.$inferInsert)[] = [];

  for (const input of inputs) {
    if (!ownedIds.has(input.itemId)) {
      notFound.push(input.itemId);
      continue;
    }
    const id = crypto.randomUUID();
    toInsert.push({
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

  if (toInsert.length > 0) {
    await tx.insert(flashcards).values(toInsert);
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
  if (updates.length === 0) return { updated: 0, notFound: [] };

  const now = new Date().toISOString();
  const ids = updates.map((u) => u.id);

  const ownedRows = await tx
    .select({ id: flashcards.id })
    .from(flashcards)
    .where(and(inArray(flashcards.id, ids), eq(flashcards.userId, userId)));
  const ownedIds = new Set(ownedRows.map((r) => r.id));

  const notFound: string[] = [];
  const toApply: UpdateFlashcardInput[] = [];
  for (const update of updates) {
    if (!ownedIds.has(update.id)) {
      notFound.push(update.id);
    } else {
      toApply.push(update);
    }
  }

  let updated = 0;
  for (const update of toApply) {
    const set: Partial<typeof flashcards.$inferInsert> = {
      updatedAt: now,
      ...(update.front !== undefined && { front: update.front }),
      ...(update.back !== undefined && { back: update.back }),
    };
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
  if (ids.length === 0) return { deleted: 0, notFound: [] };

  const ownedRows = await tx
    .select({ id: flashcards.id })
    .from(flashcards)
    .where(and(inArray(flashcards.id, ids), eq(flashcards.userId, userId)));
  const ownedIds = ownedRows.map((r) => r.id);
  const ownedSet = new Set(ownedIds);
  const notFound = ids.filter((id) => !ownedSet.has(id));

  if (ownedIds.length === 0) return { deleted: 0, notFound };

  await tx
    .delete(flashcards)
    .where(
      and(inArray(flashcards.id, ownedIds), eq(flashcards.userId, userId)),
    );

  return { deleted: ownedIds.length, notFound };
};
