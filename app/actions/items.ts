// Server-only implementations. Client code never imports this module — it
// goes through the createServerFn RPC layer in ./index.ts, whose handlers
// dynamically import this file so none of it reaches the client bundle.
// Server routes (e.g. the extension API) may call these directly.
import { withUser } from "@/db";
import { items } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { safeAction } from "@/lib/safe-action";
import { ensureTagsLinkedForItems } from "@/lib/tags";
import {
  createItems as createItemsLib,
  updateItemWithCardSync,
  deleteItems as deleteItemsLib,
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
  extractPdfTitleOnly,
  getPdfUrlForItem,
  getPdfUrlForItemSync,
  renderPdfFirstPage,
} from "@/lib/pdf-preview";
import {
  parseInput,
  deleteItemSchema,
  fetchPageTitleSchema,
  createItemSchema,
  updateItemSchema,
  toggleReadSchema,
  bulkDeleteItemsSchema,
  bulkTagSchema,
  bulkMarkReadSchema,
  bulkSetPinnedSchema,
} from "@/lib/schemas";
import { time } from "@/lib/perf";

export const searchItems = safeAction(async function searchItems(
  query: string,
): Promise<SearchResult[]> {
  return time(
    "action:searchItems",
    async () => {
      const userId = await getCurrentUserId();
      return withUser(
        userId,
        (tx) => searchItemsQuery(tx, userId, query),
        "searchItems",
      );
    },
    { qlen: query.length },
  );
}, "Could not search items. Please try again.");

export const searchFlashcards = safeAction(async function searchFlashcards(
  query: string,
): Promise<FlashcardSearchResult[]> {
  return time(
    "action:searchFlashcards",
    async () => {
      const userId = await getCurrentUserId();
      return withUser(
        userId,
        (tx) => searchFlashcardsQuery(tx, userId, query),
        "searchFlashcards",
      );
    },
    { qlen: query.length },
  );
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
    const title = typeof data.title === "string" ? data.title : null;
    if (!title) return null;
    const channel =
      typeof data.author_name === "string" ? data.author_name.trim() : "";
    return channel ? `${title} - ${channel}` : title;
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

export const fetchPageTitle = safeAction(async function fetchPageTitle(
  url: string,
): Promise<string | null> {
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

    // PDF short-circuit: if the URL clearly points at a PDF (suffix or
    // arxiv abs/pdf), extract title straight from the document. This
    // beats HTML parsing because arxiv's <title> includes the paper id
    // prefix, and direct PDFs have no HTML at all.
    const pdfUrl = getPdfUrlForItemSync(url);
    if (pdfUrl) {
      const pdfTitle = await extractPdfTitleOnly(pdfUrl);
      if (pdfTitle) return pdfTitle;
      // Fall through to HTML parse on miss — some arxiv abs pages have
      // useful <title> tags even when the PDF extraction fails.
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
        chunks.push(
          value.subarray(0, value.byteLength - (received - MAX_BYTES)),
        );
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
    if (!match || match[1] === undefined) return null;
    return decodeHtmlEntities(match[1]);
  } catch {
    return null;
  }
}, "Could not fetch page title. Please try again.");

export type CreateItemResult =
  { ok: true; itemId: string } | { ok: false; duplicate: DuplicateItem };

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
    if (itemId === undefined) {
      throw new Error("Failed to create item.");
    }
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
    hiddenFromReview?: boolean;
    tagNames?: string[];
  },
) {
  parseInput(updateItemSchema, { itemId, fields });
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) =>
    updateItemWithCardSync(tx, userId, itemId, fields),
  );
}, "Could not update item. Please try again.");

export const toggleRead = safeAction(async function toggleRead(
  itemId: string,
  read: boolean,
) {
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

export const bulkDeleteItems = safeAction(async function bulkDeleteItems(
  itemIds: string[],
) {
  parseInput(bulkDeleteItemsSchema, { itemIds });
  if (itemIds.length === 0) return;
  const userId = await getCurrentUserId();
  await withUser(userId, (tx) => deleteItemsLib(tx, userId, itemIds));
}, "Could not delete items. Please try again.");

export const bulkTag = safeAction(async function bulkTag(
  itemIds: string[],
  tagNames: string[],
) {
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

// Generate (or refresh) the preview image for a single item. Returns the
// resulting data URL, or null if the item's URL doesn't support previews.
//
// Three terminal states for the row's preview_image_url column:
//   - data URL → has a preview, render it.
//   - ""       → checked, not a PDF; don't probe again.
//   - null     → not yet attempted, or render failed transiently — retry.
//
// Idempotent: callers can fire-and-forget; calling on a row that's already
// been resolved returns the existing value without re-doing the work.
// A title is "junk" if it's clearly a placeholder that the user would want
// auto-corrected. Anything they've actually typed is left alone.
const isJunkTitle = (title: string, url: string): boolean => {
  const t = title.trim();
  if (!t) return true;
  if (t.toLowerCase() === "untitled") return true;
  if (t === url) return true;
  // arxiv abs-page <title>: "[2103.00020] Real Title". We don't auto-replace
  // because there IS a real title in there, just with a paper-id prefix.
  return false;
};

export const generateItemPreview = safeAction(
  async function generateItemPreview(itemId: string): Promise<string | null> {
    const userId = await getCurrentUserId();
    return withUser(userId, async (tx) => {
      const [item] = await tx
        .select({
          id: items.id,
          title: items.title,
          url: items.url,
          previewImageUrl: items.previewImageUrl,
        })
        .from(items)
        .where(and(eq(items.id, itemId), eq(items.userId, userId)))
        .limit(1);
      if (!item) return null;
      if (item.previewImageUrl !== null) return item.previewImageUrl || null;

      const pdfUrl = await getPdfUrlForItem(item.url);
      if (!pdfUrl) {
        // Confirmed not a PDF — stamp empty string so we don't probe again on
        // every cozy mount.
        await tx
          .update(items)
          .set({ previewImageUrl: "", updatedAt: new Date().toISOString() })
          .where(and(eq(items.id, itemId), eq(items.userId, userId)));
        return null;
      }

      const result = await renderPdfFirstPage(pdfUrl);
      // If render failed (network/timeout/oversized), leave previewImageUrl
      // null so the next cozy mount retries. Non-PDFs already returned above.
      if (!result) return null;

      const now = new Date().toISOString();
      const patch: Partial<typeof items.$inferInsert> = {
        previewImageUrl: result.imageDataUrl,
        updatedAt: now,
      };
      // Only auto-fill the title if the user clearly hasn't set one. Never
      // clobber a real title — manual edits win.
      if (result.title && isJunkTitle(item.title, item.url)) {
        patch.title = result.title;
      }
      await tx
        .update(items)
        .set(patch)
        .where(and(eq(items.id, itemId), eq(items.userId, userId)));
      return result.imageDataUrl;
    });
  },
  "Could not generate preview.",
);

export const bulkMarkRead = safeAction(async function bulkMarkRead(
  itemIds: string[],
  read: boolean,
) {
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

export const bulkSetPinned = safeAction(async function bulkSetPinned(
  itemIds: string[],
  starred: boolean,
) {
  parseInput(bulkSetPinnedSchema, { itemIds, starred });
  if (itemIds.length === 0) return;

  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  await withUser(userId, async (tx) => {
    await tx
      .update(items)
      .set({ starred, updatedAt: now })
      .where(and(inArray(items.id, itemIds), eq(items.userId, userId)));
  });
}, "Could not update items. Please try again.");
