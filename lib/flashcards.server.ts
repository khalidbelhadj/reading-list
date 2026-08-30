import { and, eq, inArray } from "drizzle-orm";

import { type db, type Tx } from "@/db";
import { flashcards } from "@/db/schema";

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
