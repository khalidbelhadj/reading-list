"use server";

import { withUser } from "@/db";
import { getCurrentUserId } from "@/lib/auth";
import { safeAction } from "@/lib/safe-action";
import {
  addItemsToList as addItemsToListLib,
  createList as createListLib,
  deleteList as deleteListLib,
  fetchLists as fetchListsLib,
  removeItemFromList as removeItemFromListLib,
  updateList as updateListLib,
  type ListWithMembers,
} from "@/lib/lists";
import {
  addItemsToListSchema,
  createListSchema,
  deleteListSchema,
  parseInput,
  removeItemFromListSchema,
  updateListSchema,
} from "@/lib/schemas";

export const fetchLists = safeAction(async function fetchLists(): Promise<ListWithMembers[]> {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) => fetchListsLib(tx, userId), "fetchLists");
}, "Could not load lists. Please try again.");

export const createList = safeAction(async function createList(
  name: string,
  icon?: string | null,
  id?: string,
): Promise<string> {
  parseInput(createListSchema, { name, icon, id });
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) => createListLib(tx, userId, { name, icon, id }));
}, "Could not create list. Please try again.");

export const updateList = safeAction(async function updateList(
  listId: string,
  fields: { name?: string; icon?: string | null },
) {
  parseInput(updateListSchema, { listId, fields });
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) => updateListLib(tx, userId, listId, fields));
}, "Could not update list. Please try again.");

export const deleteList = safeAction(async function deleteList(listId: string) {
  parseInput(deleteListSchema, { listId });
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) => deleteListLib(tx, userId, listId));
}, "Could not delete list. Please try again.");

export const addItemsToList = safeAction(async function addItemsToList(
  listId: string,
  itemIds: string[],
) {
  parseInput(addItemsToListSchema, { listId, itemIds });
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) => addItemsToListLib(tx, userId, listId, itemIds));
}, "Could not add to list. Please try again.");

export const removeItemFromList = safeAction(async function removeItemFromList(
  listId: string,
  itemId: string,
) {
  parseInput(removeItemFromListSchema, { listId, itemId });
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) => removeItemFromListLib(tx, userId, listId, itemId));
}, "Could not remove from list. Please try again.");
