import { and, eq, inArray, notExists, sql } from "drizzle-orm";

import { db, type Tx } from "@/db";
import { itemsTags, tags } from "@/db/schema";

export const pruneOrphanTags = async (
  tx: Tx | typeof db,
  userId: string,
  tagIds: number[],
) => {
  const unique = Array.from(new Set(tagIds));
  if (unique.length === 0) return;
  await tx
    .delete(tags)
    .where(
      and(
        eq(tags.userId, userId),
        inArray(tags.id, unique),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(itemsTags)
            .where(eq(itemsTags.tagId, tags.id)),
        ),
      ),
    );
};

const upsertTagsAndGetIds = async (
  tx: Tx | typeof db,
  userId: string,
  tagNames: string[],
): Promise<number[]> => {
  const unique = Array.from(new Set(tagNames));
  if (unique.length === 0) return [];

  await tx
    .insert(tags)
    .values(unique.map((name) => ({ userId, name })))
    .onConflictDoNothing();

  const found = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(tags.name, unique)));

  return found.map((t) => t.id);
};

export const ensureTagsLinked = async (
  tx: Tx | typeof db,
  userId: string,
  itemId: string,
  tagNames: string[],
) => {
  const tagIds = await upsertTagsAndGetIds(tx, userId, tagNames);
  if (tagIds.length === 0) return;

  await tx
    .insert(itemsTags)
    .values(tagIds.map((tagId) => ({ itemId, tagId })))
    .onConflictDoNothing();
};

export const ensureTagsLinkedForItems = async (
  tx: Tx | typeof db,
  userId: string,
  itemIds: string[],
  tagNames: string[],
) => {
  if (itemIds.length === 0) return;
  const tagIds = await upsertTagsAndGetIds(tx, userId, tagNames);
  if (tagIds.length === 0) return;

  const rows = itemIds.flatMap((itemId) =>
    tagIds.map((tagId) => ({ itemId, tagId })),
  );
  await tx.insert(itemsTags).values(rows).onConflictDoNothing();
};

export const syncItemTags = async (
  tx: Tx | typeof db,
  userId: string,
  itemId: string,
  tagNames: string[],
) => {
  const existingLinks = await tx
    .select({ tagId: itemsTags.tagId })
    .from(itemsTags)
    .where(eq(itemsTags.itemId, itemId));
  const existingTagIds = existingLinks.map((l) => l.tagId);

  const newTagIds = await upsertTagsAndGetIds(tx, userId, tagNames);

  const existingSet = new Set(existingTagIds);
  const newSet = new Set(newTagIds);
  const removedTagIds = existingTagIds.filter((id) => !newSet.has(id));
  const addedTagIds = newTagIds.filter((id) => !existingSet.has(id));

  if (removedTagIds.length > 0) {
    await tx
      .delete(itemsTags)
      .where(
        and(
          eq(itemsTags.itemId, itemId),
          inArray(itemsTags.tagId, removedTagIds),
        ),
      );
  }

  if (addedTagIds.length > 0) {
    await tx
      .insert(itemsTags)
      .values(addedTagIds.map((tagId) => ({ itemId, tagId })))
      .onConflictDoNothing();
  }

  await pruneOrphanTags(tx, userId, removedTagIds);
};
