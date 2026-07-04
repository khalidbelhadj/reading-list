import { db, type Tx } from "@/db";
import { items, itemsTags, flashcards } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  ensureTagsLinkedForItems,
  syncItemTags,
  pruneOrphanTags,
} from "@/lib/tags";
import { normalizeUrl } from "@/lib/url";
import { syncFlashcardsFromNotes } from "@/lib/flashcard-sync";

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
  const withIds = inputs.map((input) => ({
    input,
    id: input.id ?? crypto.randomUUID(),
  }));
  const ids = withIds.map((entry) => entry.id);

  await tx.insert(items).values(
    withIds.map(({ input, id }) => ({
      id,
      userId,
      title: input.title,
      url: normalizeUrl(input.url) ?? input.url,
      faviconUrl: input.faviconUrl ?? null,
      starred: false,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })),
  );

  // Group items by identical tag sets so we ensure each unique set once
  const byTagSet = new Map<string, { itemIds: string[]; tagNames: string[] }>();
  for (const { input, id } of withIds) {
    const tagNames = input.tagNames ?? [];
    if (tagNames.length === 0) continue;
    const key = JSON.stringify(Array.from(new Set(tagNames)).sort());
    const bucket = byTagSet.get(key);
    if (bucket) {
      bucket.itemIds.push(id);
    } else {
      byTagSet.set(key, { itemIds: [id], tagNames });
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

// Update an item and, when its notes change, reconcile inline flashcards from
// the new notes (notes is the source of truth). Shared by every notes-write
// path — the web action and the MCP server — so the `flashcards` table never
// drifts from the notes. Gated on ownership (updateItem returns false
// otherwise). When card ids were rewritten (duplicates/missing), the normalized
// notes are persisted so the document is stable and won't churn rows next save.
export const updateItemWithCardSync = async (
  tx: Tx | typeof db,
  userId: string,
  itemId: string,
  fields: UpdateItemFields,
): Promise<boolean> => {
  const updated = await updateItem(tx, userId, itemId, fields);
  if (updated && fields.notes !== undefined) {
    const { normalizedNotes } = await syncFlashcardsFromNotes(
      tx,
      userId,
      itemId,
      fields.notes,
    );
    if (normalizedNotes !== null) {
      await updateItem(tx, userId, itemId, { notes: normalizedNotes });
    }
  }
  return updated;
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

  return { deleted: ownedIds, notFound };
};
