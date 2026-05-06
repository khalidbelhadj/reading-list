import { db, type Tx } from "@/db";
import { items, itemsTags, flashcards } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ensureTagsLinked, syncItemTags, pruneOrphanTags } from "@/lib/tags";

export type CreateItemInput = {
  title: string;
  url: string;
  tagNames?: string[];
  faviconUrl?: string;
  notes?: string;
  id?: string;
};

export const createItems = async (
  tx: Tx | typeof db,
  userId: string,
  inputs: CreateItemInput[],
): Promise<string[]> => {
  if (inputs.length === 0) return [];

  const now = new Date().toISOString();
  const ids = inputs.map((input) => input.id ?? crypto.randomUUID());

  await tx
    .update(items)
    .set({ position: sql`${items.position} + ${inputs.length}` })
    .where(eq(items.userId, userId));

  for (let idx = 0; idx < inputs.length; idx++) {
    const input = inputs[idx];
    const itemId = ids[idx];
    await tx.insert(items).values({
      id: itemId,
      userId,
      title: input.title,
      url: input.url,
      faviconUrl: input.faviconUrl ?? null,
      starred: false,
      notes: input.notes ?? null,
      position: idx,
      createdAt: now,
      updatedAt: now,
    });
    await ensureTagsLinked(tx, userId, itemId, input.tagNames ?? []);
  }

  return ids;
};

export type UpdateItemFields = {
  title?: string;
  url?: string;
  faviconUrl?: string;
  starred?: boolean;
  notes?: string;
  read?: boolean;
  tagNames?: string[];
};

export const updateItem = async (
  tx: Tx | typeof db,
  userId: string,
  itemId: string,
  fields: UpdateItemFields,
): Promise<boolean> => {
  const [owned] = await tx
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  if (!owned) return false;

  const now = new Date().toISOString();
  const set: Record<string, unknown> = { updatedAt: now };
  if (fields.title !== undefined) set.title = fields.title;
  if (fields.url !== undefined) set.url = fields.url;
  if (fields.faviconUrl !== undefined) set.faviconUrl = fields.faviconUrl;
  if (fields.starred !== undefined) set.starred = fields.starred;
  if (fields.notes !== undefined) set.notes = fields.notes;
  if (fields.read !== undefined) set.read = fields.read;

  await tx
    .update(items)
    .set(set)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)));

  if (fields.tagNames !== undefined) {
    await syncItemTags(tx, userId, itemId, fields.tagNames);
  }

  return true;
};

export const deleteItems = async (
  tx: Tx | typeof db,
  userId: string,
  itemIds: string[],
): Promise<{ deleted: string[]; notFound: string[] }> => {
  if (itemIds.length === 0) return { deleted: [], notFound: [] };

  const ownedItems = await tx
    .select({ id: items.id })
    .from(items)
    .where(and(inArray(items.id, itemIds), eq(items.userId, userId)));
  const ownedIds = ownedItems.map((i) => i.id);
  const notFound = itemIds.filter((id) => !ownedIds.includes(id));

  if (ownedIds.length === 0) return { deleted: [], notFound };

  const affectedTagIds = (
    await tx
      .select({ tagId: itemsTags.tagId })
      .from(itemsTags)
      .where(inArray(itemsTags.itemId, ownedIds))
  ).map((r) => r.tagId);

  await tx.delete(itemsTags).where(inArray(itemsTags.itemId, ownedIds));
  await tx
    .delete(flashcards)
    .where(
      and(inArray(flashcards.itemId, ownedIds), eq(flashcards.userId, userId)),
    );
  await tx
    .delete(items)
    .where(and(inArray(items.id, ownedIds), eq(items.userId, userId)));

  await pruneOrphanTags(tx, userId, affectedTagIds);
  await recompactPositions(tx, userId);

  return { deleted: ownedIds, notFound };
};

export const recompactPositions = async (
  tx: Tx | typeof db,
  userId: string,
) => {
  await tx.execute(sql`
    UPDATE ${items} SET position = sub.new_pos
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY position) - 1 AS new_pos
      FROM ${items}
      WHERE user_id = ${userId}
    ) sub
    WHERE ${items}.id = sub.id
  `);
};
