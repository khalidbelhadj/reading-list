// Server-only implementations — see ./index.ts for the RPC layer.
import { and, eq, sql } from "drizzle-orm";

import { itemsTags, tags } from "@/db/schema";
import { withCurrentUser } from "@/lib/db-helpers.server";
import { safeAction } from "@/lib/safe-action";
import { deleteTagSchema, parseInput, renameTagSchema } from "@/lib/schemas";
import { deleteTagById } from "@/lib/tags.server";

export const renameTag = safeAction(async function renameTag(
  tagId: number,
  newName: string,
) {
  parseInput(renameTagSchema, { tagId, newName });
  const trimmed = newName.trim().toLowerCase();
  if (!trimmed) return;
  await withCurrentUser(async (tx, userId) => {
    const [tag] = await tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
    if (!tag || tag.name === trimmed) return;

    const [existing] = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), eq(tags.name, trimmed)));

    if (existing) {
      await tx.execute(sql`
        INSERT INTO items_tags (item_id, tag_id)
        SELECT item_id, ${existing.id}
        FROM items_tags
        WHERE tag_id = ${tagId}
        ON CONFLICT DO NOTHING
      `);
      await tx.delete(itemsTags).where(eq(itemsTags.tagId, tagId));
      await tx
        .delete(tags)
        .where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
    } else {
      await tx
        .update(tags)
        .set({ name: trimmed })
        .where(and(eq(tags.id, tagId), eq(tags.userId, userId)));
    }
  });
}, "Could not rename tag. Please try again.");

export const deleteTag = safeAction(async function deleteTag(tagId: number) {
  parseInput(deleteTagSchema, { tagId });
  await withCurrentUser((tx, userId) => deleteTagById(tx, userId, tagId));
}, "Could not delete tag. Please try again.");
