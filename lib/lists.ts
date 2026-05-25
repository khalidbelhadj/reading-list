import { db, type Tx } from "@/db";
import { items, itemsLists, lists } from "@/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

export type CreateListInput = {
  name: string;
  icon?: string | null;
  id?: string;
};

export const createList = async (
  tx: Tx | typeof db,
  userId: string,
  input: CreateListInput,
): Promise<string> => {
  const now = new Date().toISOString();
  const id = input.id ?? crypto.randomUUID();

  const [{ maxPos }] = (await tx.execute(sql`
    SELECT COALESCE(MAX(position), -1) AS "maxPos"
    FROM ${lists}
    WHERE user_id = ${userId}::uuid
  `)) as unknown as Array<{ maxPos: number }>;

  await tx.insert(lists).values({
    id,
    userId,
    name: input.name,
    icon: input.icon ?? null,
    position: Number(maxPos) + 1,
    createdAt: now,
    updatedAt: now,
  });
  return id;
};

export type UpdateListFields = {
  name?: string;
  icon?: string | null;
};

export const updateList = async (
  tx: Tx | typeof db,
  userId: string,
  listId: string,
  fields: UpdateListFields,
): Promise<boolean> => {
  const [owned] = await tx
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)));
  if (!owned) return false;

  await tx
    .update(lists)
    .set({
      ...(fields.name !== undefined && { name: fields.name }),
      ...(fields.icon !== undefined && { icon: fields.icon }),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)));
  return true;
};

export const deleteList = async (
  tx: Tx | typeof db,
  userId: string,
  listId: string,
): Promise<boolean> => {
  const [owned] = await tx
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)));
  if (!owned) return false;

  await tx.delete(lists).where(and(eq(lists.id, listId), eq(lists.userId, userId)));
  return true;
};

export const addItemsToList = async (
  tx: Tx | typeof db,
  userId: string,
  listId: string,
  itemIds: string[],
): Promise<void> => {
  if (itemIds.length === 0) return;

  const [owned] = await tx
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)));
  if (!owned) return;

  const ownedItems = await tx
    .select({ id: items.id })
    .from(items)
    .where(and(inArray(items.id, itemIds), eq(items.userId, userId)));
  const ownedIds = ownedItems.map((i) => i.id);
  if (ownedIds.length === 0) return;

  const [{ maxPos }] = (await tx.execute(sql`
    SELECT COALESCE(MAX(position), -1) AS "maxPos"
    FROM ${itemsLists}
    WHERE list_id = ${listId}
  `)) as unknown as Array<{ maxPos: number }>;

  const now = new Date().toISOString();
  let pos = Number(maxPos) + 1;
  await tx
    .insert(itemsLists)
    .values(
      ownedIds.map((itemId) => ({
        itemId,
        listId,
        position: pos++,
        addedAt: now,
      })),
    )
    .onConflictDoNothing();
};

export const removeItemFromList = async (
  tx: Tx | typeof db,
  userId: string,
  listId: string,
  itemId: string,
): Promise<void> => {
  await removeItemsFromList(tx, userId, listId, [itemId]);
};

export const removeItemsFromList = async (
  tx: Tx | typeof db,
  userId: string,
  listId: string,
  itemIds: string[],
): Promise<void> => {
  if (itemIds.length === 0) return;

  const [owned] = await tx
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)));
  if (!owned) return;

  await tx
    .delete(itemsLists)
    .where(
      and(
        eq(itemsLists.listId, listId),
        inArray(itemsLists.itemId, itemIds),
      ),
    );
};

export type ListWithMembers = {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  itemIds: string[];
};

export const fetchLists = async (
  tx: Tx | typeof db,
  userId: string,
): Promise<ListWithMembers[]> => {
  const rows = await tx
    .select()
    .from(lists)
    .where(eq(lists.userId, userId))
    .orderBy(asc(lists.position));

  if (rows.length === 0) return [];

  const memberships = await tx
    .select({
      listId: itemsLists.listId,
      itemId: itemsLists.itemId,
      position: itemsLists.position,
    })
    .from(itemsLists)
    .where(
      inArray(
        itemsLists.listId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(itemsLists.position));

  const byListId = new Map<string, string[]>();
  for (const m of memberships) {
    const existing = byListId.get(m.listId);
    if (existing) existing.push(m.itemId);
    else byListId.set(m.listId, [m.itemId]);
  }

  return rows.map((row) => ({
    ...row,
    itemIds: byListId.get(row.id) ?? [],
  }));
};
