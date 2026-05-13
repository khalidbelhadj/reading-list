"use server";

import { withUser } from "@/db";
import { items } from "@/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { safeAction } from "@/lib/safe-action";
import { ensureTagsLinked } from "@/lib/tags";
import {
  createItems as createItemsLib,
  updateItem as updateItemLib,
  deleteItems as deleteItemsLib,
} from "@/lib/items";
import {
  searchItems as searchItemsQuery,
  searchFlashcards as searchFlashcardsQuery,
  type SearchResult,
  type FlashcardSearchResult,
} from "@/lib/search";
import { assertPublicUrl } from "@/lib/url.server";
import {
  parseInput,
  deleteItemSchema,
  fetchPageTitleSchema,
  createItemSchema,
  updateItemSchema,
  reorderItemSchema,
  toggleReadSchema,
  bulkDeleteItemsSchema,
  bulkTagSchema,
  bulkMarkReadSchema,
} from "@/lib/schemas";

export const searchItems = safeAction(async function searchItems(query: string): Promise<SearchResult[]> {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) => searchItemsQuery(tx, userId, query));
}, "Could not search items. Please try again.");

export const searchFlashcards = safeAction(async function searchFlashcards(query: string): Promise<FlashcardSearchResult[]> {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) => searchFlashcardsQuery(tx, userId, query));
}, "Could not search flashcards. Please try again.");

export const deleteItem = safeAction(async function deleteItem(itemId: string) {
  parseInput(deleteItemSchema, { itemId });
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) => deleteItemsLib(tx, userId, [itemId]));
}, "Could not delete item. Please try again.");

async function fetchOembedTitle(url: string): Promise<string | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.title || null;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .trim()
    .replace(/\s+/g, " ");
}

export const fetchPageTitle = safeAction(async function fetchPageTitle(url: string): Promise<string | null> {
  parseInput(fetchPageTitleSchema, { url });
  try {
    await assertPublicUrl(url);

    const parsed = new URL(url);
    const isYouTube = /^(www\.)?(youtube\.com|youtu\.be)$/.test(
      parsed.hostname,
    );
    if (isYouTube) {
      const title = await fetchOembedTitle(url);
      if (title) return title;
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const ogMatch =
      text.match(
        /<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i,
      ) ||
      text.match(
        /<meta[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:title["'][^>]*>/i,
      );
    const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const match = ogMatch || titleMatch;
    if (!match) return null;
    return decodeHtmlEntities(match[1]);
  } catch {
    return null;
  }
}, "Could not fetch page title. Please try again.");

export const createItem = safeAction(async function createItem(
  title: string,
  url: string,
  tagNames: string[],
  faviconUrl?: string,
  notes?: string,
  id?: string,
) {
  parseInput(createItemSchema, { title, url, tagNames, faviconUrl, notes, id });
  const userId = await getCurrentUserId();
  return withUser(userId, async (tx) => {
    const [itemId] = await createItemsLib(tx, userId, [
      { title, url, tagNames, faviconUrl, notes, id },
    ]);
    return itemId;
  });
}, "Could not create item. Please try again.");

export const updateItem = safeAction(async function updateItem(
  itemId: string,
  fields: {
    title?: string;
    url?: string;
    faviconUrl?: string;
    starred?: boolean;
    notes?: string;
    read?: boolean;
    tagNames?: string[];
  },
) {
  parseInput(updateItemSchema, { itemId, fields });
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) => updateItemLib(tx, userId, itemId, fields));
}, "Could not update item. Please try again.");

export const reorderItem = safeAction(async function reorderItem(
  itemId: string,
  newPosition: number,
) {
  parseInput(reorderItemSchema, { itemId, newPosition });
  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    const typeItems = await tx
      .select({ id: items.id, position: items.position })
      .from(items)
      .where(eq(items.userId, userId))
      .orderBy(asc(items.position));

    const currentIndex = typeItems.findIndex((i) => i.id === itemId);
    if (currentIndex === -1) return;

    const [movedItem] = typeItems.splice(currentIndex, 1);
    const clamped = Math.max(0, Math.min(newPosition, typeItems.length));
    typeItems.splice(clamped, 0, movedItem);

    const updates = typeItems
      .map((item, i) => ({ id: item.id, position: i }))
      .filter((u, i) => typeItems[i].position !== u.position);

    if (updates.length > 0) {
      const idValues = sql.join(updates.map((u) => sql`${u.id}`), sql`, `);
      const posValues = sql.join(updates.map((u) => sql`${u.position}`), sql`, `);
      await tx.execute(sql`
        UPDATE ${items} SET position = v.new_pos::int
        FROM (
          SELECT unnest(ARRAY[${idValues}]::text[]) AS id,
                 unnest(ARRAY[${posValues}]::int[]) AS new_pos
        ) v
        WHERE ${items}.id = v.id
          AND ${items}.user_id = ${userId}::uuid
      `);
    }
  });
}, "Could not reorder items. Please try again.");

export const toggleRead = safeAction(async function toggleRead(itemId: string, read: boolean) {
  parseInput(toggleReadSchema, { itemId, read });
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  await withUser(userId, async (tx) => {
    await tx
      .update(items)
      .set({ read, readAt: read ? now : null, updatedAt: now })
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));
  });
}, "Could not mark item as read. Please try again.");

export const bulkDeleteItems = safeAction(async function bulkDeleteItems(itemIds: string[]) {
  parseInput(bulkDeleteItemsSchema, { itemIds });
  if (itemIds.length === 0) return;
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) => deleteItemsLib(tx, userId, itemIds));
}, "Could not delete items. Please try again.");

export const bulkTag = safeAction(async function bulkTag(itemIds: string[], tagNames: string[]) {
  parseInput(bulkTagSchema, { itemIds, tagNames });
  if (itemIds.length === 0 || tagNames.length === 0) return;

  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    const owned = await tx
      .select({ id: items.id })
      .from(items)
      .where(and(inArray(items.id, itemIds), eq(items.userId, userId)));
    const ownedIds = owned.map((i) => i.id);
    if (ownedIds.length === 0) return;

    for (const itemId of ownedIds) {
      await ensureTagsLinked(tx, userId, itemId, tagNames);
    }
  });
}, "Could not tag items. Please try again.");

export const bulkMarkRead = safeAction(async function bulkMarkRead(itemIds: string[], read: boolean) {
  parseInput(bulkMarkReadSchema, { itemIds, read });
  if (itemIds.length === 0) return;

  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  await withUser(userId, async (tx) => {
    await tx
      .update(items)
      .set({ read, readAt: read ? now : null, updatedAt: now })
      .where(and(inArray(items.id, itemIds), eq(items.userId, userId)));
  });
}, "Could not update items. Please try again.");
