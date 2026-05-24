import { db, type Tx } from "@/db";
import { items, itemsTags, flashcards } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  ensureTagsLinkedForItems,
  syncItemTags,
  pruneOrphanTags,
} from "@/lib/tags";
import { normalizeUrl } from "@/lib/url";

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

  // Insert new items above all existing ones by anchoring at min(position) - 1
  // and giving each new item a slot of width 1 below that anchor. No need to
  // rewrite existing rows.
  const [{ minPos }] = (await tx.execute(sql`
    SELECT COALESCE(MIN(position), 0) AS "minPos"
    FROM ${items}
    WHERE user_id = ${userId}::uuid
  `)) as unknown as Array<{ minPos: number }>;

  const anchor = Number(minPos) - inputs.length;

  await tx.insert(items).values(
    inputs.map((input, idx) => ({
      id: ids[idx],
      userId,
      title: input.title,
      url: normalizeUrl(input.url) ?? input.url,
      faviconUrl: input.faviconUrl ?? null,
      starred: false,
      notes: input.notes ?? null,
      position: anchor + idx,
      createdAt: now,
      updatedAt: now,
    })),
  );

  // Group items by identical tag sets so we ensure each unique set once
  const byTagSet = new Map<string, { itemIds: string[]; tagNames: string[] }>();
  for (let idx = 0; idx < inputs.length; idx++) {
    const tagNames = inputs[idx].tagNames ?? [];
    if (tagNames.length === 0) continue;
    const key = JSON.stringify(Array.from(new Set(tagNames)).sort());
    const bucket = byTagSet.get(key);
    if (bucket) {
      bucket.itemIds.push(ids[idx]);
    } else {
      byTagSet.set(key, { itemIds: [ids[idx]], tagNames });
    }
  }
  for (const { itemIds, tagNames } of byTagSet.values()) {
    await ensureTagsLinkedForItems(tx, userId, itemIds, tagNames);
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
  const set: Partial<typeof items.$inferInsert> = {
    updatedAt: now,
    ...(fields.title !== undefined && { title: fields.title }),
    ...(fields.url !== undefined && { url: fields.url }),
    ...(fields.faviconUrl !== undefined && { faviconUrl: fields.faviconUrl }),
    ...(fields.starred !== undefined && { starred: fields.starred }),
    ...(fields.notes !== undefined && { notes: fields.notes }),
    ...(fields.read !== undefined && { read: fields.read }),
  };

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
  // No recompaction on delete: fractional positions tolerate gaps, and
  // recompacting on every delete used to rewrite every row in the table.

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
