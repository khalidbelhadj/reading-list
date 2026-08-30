import { and, eq, inArray } from "drizzle-orm";

import { type db, type Tx } from "@/db";
import { flashcards, items } from "@/db/schema";
import { syncFlashcardsFromNotes } from "@/lib/flashcard-sync.server";
import { normalizeUrl } from "@/lib/url";

export type CreateItemInput = {
  title: string;
  url: string;
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

  return ids;
};

export type UpdateItemFields = {
  title?: string;
  url?: string;
  faviconUrl?: string;
  starred?: boolean;
  notes?: string;
  read?: boolean;
  hiddenFromReview?: boolean;
};

const updateItem = async (
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
    // Normalize exactly like createItems, so an edited URL can't dodge the
    // duplicate check that compares against stored (normalized) urls. Empty
    // string means "remove the link" and passes through.
    ...(fields.url !== undefined && {
      url: fields.url === "" ? "" : (normalizeUrl(fields.url) ?? fields.url),
    }),
    ...(fields.faviconUrl !== undefined && { faviconUrl: fields.faviconUrl }),
    ...(fields.starred !== undefined && { starred: fields.starred }),
    ...(fields.notes !== undefined && { notes: fields.notes }),
    ...(fields.read !== undefined && { read: fields.read }),
    ...(fields.hiddenFromReview !== undefined && {
      hiddenFromReview: fields.hiddenFromReview,
    }),
  };

  await tx
    .update(items)
    .set(set)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)));

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

  await tx
    .delete(flashcards)
    .where(
      and(inArray(flashcards.itemId, ownedIds), eq(flashcards.userId, userId)),
    );
  await tx
    .delete(items)
    .where(and(inArray(items.id, ownedIds), eq(items.userId, userId)));

  return { deleted: ownedIds, notFound };
};
