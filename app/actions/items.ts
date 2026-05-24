"use server";

import { withUser } from "@/db";
import { items } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { safeAction } from "@/lib/safe-action";
import { ensureTagsLinkedForItems } from "@/lib/tags";
import {
  createItems as createItemsLib,
  updateItem as updateItemLib,
  deleteItems as deleteItemsLib,
  recompactPositions,
} from "@/lib/items";
import {
  searchItems as searchItemsQuery,
  searchFlashcards as searchFlashcardsQuery,
  type SearchResult,
  type FlashcardSearchResult,
} from "@/lib/search";
import { safeFetch } from "@/lib/url.server";
import { normalizeUrl, type DuplicateItem } from "@/lib/url";
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
import { time } from "@/lib/perf";

export const searchItems = safeAction(async function searchItems(query: string): Promise<SearchResult[]> {
  return time("action:searchItems", async () => {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) => searchItemsQuery(tx, userId, query), "searchItems");
  }, { qlen: query.length });
}, "Could not search items. Please try again.");

export const searchFlashcards = safeAction(async function searchFlashcards(query: string): Promise<FlashcardSearchResult[]> {
  return time("action:searchFlashcards", async () => {
  const userId = await getCurrentUserId();
  return withUser(userId, (tx) => searchFlashcardsQuery(tx, userId, query), "searchFlashcards");
  }, { qlen: query.length });
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
    const parsed = new URL(url);
    const isYouTube = /^(www\.)?(youtube\.com|youtu\.be)$/.test(
      parsed.hostname,
    );
    if (isYouTube) {
      const title = await fetchOembedTitle(url);
      if (title) return title;
    }

    const res = await safeFetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const MAX_BYTES = 512 * 1024;
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BYTES) {
        chunks.push(value.subarray(0, value.byteLength - (received - MAX_BYTES)));
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(merged);
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

export type CreateItemResult =
  | { ok: true; itemId: string }
  | { ok: false; duplicate: DuplicateItem };

export const createItem = safeAction(async function createItem(
  title: string,
  url: string,
  tagNames: string[],
  faviconUrl?: string,
  notes?: string,
  id?: string,
  allowDuplicateUrl?: boolean,
): Promise<CreateItemResult> {
  parseInput(createItemSchema, { title, url, tagNames, faviconUrl, notes, id });
  const userId = await getCurrentUserId();
  return withUser(userId, async (tx) => {
    if (!allowDuplicateUrl) {
      const normalized = normalizeUrl(url);
      if (normalized) {
        const [existing] = await tx
          .select({
            id: items.id,
            title: items.title,
            url: items.url,
            faviconUrl: items.faviconUrl,
          })
          .from(items)
          .where(and(eq(items.userId, userId), eq(items.url, normalized)))
          .limit(1);
        if (existing) return { ok: false as const, duplicate: existing };
      }
    }
    const [itemId] = await createItemsLib(tx, userId, [
      { title, url, tagNames, faviconUrl, notes, id },
    ]);
    return { ok: true as const, itemId };
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

const computeMidpoint = (
  before: number | null,
  after: number | null,
): number => {
  if (before === null && after === null) return 0;
  if (before === null && after !== null) return after - 1;
  if (after === null && before !== null) return before + 1;
  return ((before as number) + (after as number)) / 2;
};

export const reorderItem = safeAction(async function reorderItem(
  itemId: string,
  newPosition: number,
) {
  parseInput(reorderItemSchema, { itemId, newPosition });
  const userId = await getCurrentUserId();
  await withUser(userId, async (tx) => {
    const ordered = await tx
      .select({ id: items.id, position: items.position })
      .from(items)
      .where(eq(items.userId, userId))
      .orderBy(asc(items.position));

    const currentIndex = ordered.findIndex((i) => i.id === itemId);
    if (currentIndex === -1) return;

    const without = ordered.filter((_, i) => i !== currentIndex);
    const clamped = Math.max(0, Math.min(newPosition, without.length));
    if (clamped === currentIndex) return;

    const before = clamped > 0 ? without[clamped - 1].position : null;
    const after = clamped < without.length ? without[clamped].position : null;
    let newPos = computeMidpoint(before, after);

    // If neighbors are so dense that the midpoint collides, recompact once
    // and recompute.
    if (
      (before !== null && newPos === before) ||
      (after !== null && newPos === after)
    ) {
      await recompactPositions(tx, userId);
      const reordered = await tx
        .select({ id: items.id, position: items.position })
        .from(items)
        .where(eq(items.userId, userId))
        .orderBy(asc(items.position));
      const withoutR = reordered.filter((i) => i.id !== itemId);
      const beforeR = clamped > 0 ? withoutR[clamped - 1].position : null;
      const afterR =
        clamped < withoutR.length ? withoutR[clamped].position : null;
      newPos = computeMidpoint(beforeR, afterR);
    }

    await tx
      .update(items)
      .set({ position: newPos })
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));
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

    await ensureTagsLinkedForItems(tx, userId, ownedIds, tagNames);
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
