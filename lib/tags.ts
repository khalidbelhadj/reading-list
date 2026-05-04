import { and, eq, inArray, notExists, sql } from "drizzle-orm";

import { db, type Tx } from "@/db";
import { itemsTags, tags } from "@/db/schema";

/**
 * Delete tags from `tagIds` that are no longer referenced by any items_tags
 * row. Scoped to `userId` and to the supplied set so we never scan the whole
 * tags table. Safe to call with an empty `tagIds` (no-op).
 *
 * Call this after any DELETE on items_tags so the tags table doesn't bloat
 * with rows that no item uses.
 */
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
