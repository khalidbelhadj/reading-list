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

export const ensureTagsLinked = async (
  tx: Tx | typeof db,
  userId: string,
  itemId: string,
  tagNames: string[],
) => {
  for (const tagName of tagNames) {
    await tx
      .insert(tags)
      .values({ userId, name: tagName })
      .onConflictDoNothing();
    const [tag] = await tx
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), eq(tags.name, tagName)));
    if (tag) {
      await tx
        .insert(itemsTags)
        .values({ itemId, tagId: tag.id })
        .onConflictDoNothing();
    }
  }
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

  const newTagIds: number[] = [];
  for (const tagName of tagNames) {
    await tx
      .insert(tags)
      .values({ userId, name: tagName })
      .onConflictDoNothing();
    const [tag] = await tx
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), eq(tags.name, tagName)));
    if (tag) newTagIds.push(tag.id);
  }

  const removedTagIds: number[] = [];
  for (const tagId of existingTagIds) {
    if (!newTagIds.includes(tagId)) {
      await tx
        .delete(itemsTags)
        .where(
          and(eq(itemsTags.itemId, itemId), eq(itemsTags.tagId, tagId)),
        );
      removedTagIds.push(tagId);
    }
  }

  for (const tagId of newTagIds) {
    if (!existingTagIds.includes(tagId)) {
      await tx.insert(itemsTags).values({ itemId, tagId });
    }
  }

  await pruneOrphanTags(tx, userId, removedTagIds);
};
