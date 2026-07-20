// Server-only implementations. Client code never imports this module — it
// goes through the createServerFn RPC layer in ./index.ts, whose handlers
// dynamically import this file so none of it reaches the client bundle.
// Server routes (e.g. the extension API) may call these directly.
import { and, eq, inArray } from "drizzle-orm";

import { items } from "@/db/schema";
import { withCurrentUser } from "@/lib/db-helpers.server";
import {
  createItems as createItemsLib,
  deleteItems as deleteItemsLib,
  updateItemWithCardSync,
} from "@/lib/items.server";
import { fetchPageTitleForUrl } from "@/lib/page-title.server";
import { getPdfUrlForItem, renderPdfFirstPage } from "@/lib/pdf-preview.server";
import { time } from "@/lib/perf";
import { ActionError, safeAction } from "@/lib/safe-action";
import {
  bulkDeleteItemsSchema,
  bulkMarkReadSchema,
  bulkSetStarredSchema,
  bulkTagSchema,
  createItemSchema,
  deleteItemSchema,
  fetchPageTitleSchema,
  parseInput,
  setItemReadSchema,
  updateItemSchema,
} from "@/lib/schemas";
import {
  searchItems as searchItemsQuery,
  type SearchResult,
} from "@/lib/search.server";
import { ensureTagsLinkedForItems } from "@/lib/tags.server";
import { type DuplicateItem, normalizeUrl } from "@/lib/url";

export const searchItems = safeAction(async function searchItems(
  query: string,
): Promise<SearchResult[]> {
  return time(
    "action:searchItems",
    () =>
      withCurrentUser(
        (tx, userId) => searchItemsQuery(tx, userId, query),
        "searchItems",
      ),
    { qlen: query.length },
  );
}, "Could not search items. Please try again.");

export const deleteItem = safeAction(async function deleteItem(itemId: string) {
  parseInput(deleteItemSchema, { itemId });
  await withCurrentUser((tx, userId) => deleteItemsLib(tx, userId, [itemId]));
}, "Could not delete item. Please try again.");

export const fetchPageTitle = safeAction(async function fetchPageTitle(
  url: string,
): Promise<string | null> {
  parseInput(fetchPageTitleSchema, { url });
  return fetchPageTitleForUrl(url);
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
  return withCurrentUser(async (tx, userId) => {
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
      throw new ActionError("Failed to create item.");
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
  await withCurrentUser((tx, userId) =>
    updateItemWithCardSync(tx, userId, itemId, fields),
  );
}, "Could not update item. Please try again.");

export const setItemRead = safeAction(async function setItemRead(
  itemId: string,
  read: boolean,
) {
  parseInput(setItemReadSchema, { itemId, read });
  const now = new Date().toISOString();
  await withCurrentUser(async (tx, userId) => {
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
  await withCurrentUser((tx, userId) => deleteItemsLib(tx, userId, itemIds));
}, "Could not delete items. Please try again.");

export const bulkTag = safeAction(async function bulkTag(
  itemIds: string[],
  tagNames: string[],
) {
  parseInput(bulkTagSchema, { itemIds, tagNames });
  if (itemIds.length === 0 || tagNames.length === 0) return;

  await withCurrentUser(async (tx, userId) => {
    const owned = await tx
      .select({ id: items.id })
      .from(items)
      .where(and(inArray(items.id, itemIds), eq(items.userId, userId)));
    const ownedIds = owned.map((i) => i.id);
    if (ownedIds.length === 0) return;

    await ensureTagsLinkedForItems(tx, userId, ownedIds, tagNames);
  });
}, "Could not tag items. Please try again.");

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
export const generateItemPreview = safeAction(
  async function generateItemPreview(itemId: string): Promise<string | null> {
    return withCurrentUser(async (tx, userId) => {
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

  const now = new Date().toISOString();
  await withCurrentUser(async (tx, userId) => {
    await tx
      .update(items)
      .set({ read, readAt: read ? now : null, updatedAt: now })
      .where(and(inArray(items.id, itemIds), eq(items.userId, userId)));
  });
}, "Could not update items. Please try again.");

export const bulkSetStarred = safeAction(async function bulkSetStarred(
  itemIds: string[],
  starred: boolean,
) {
  parseInput(bulkSetStarredSchema, { itemIds, starred });
  if (itemIds.length === 0) return;

  const now = new Date().toISOString();
  await withCurrentUser(async (tx, userId) => {
    await tx
      .update(items)
      .set({ starred, updatedAt: now })
      .where(and(inArray(items.id, itemIds), eq(items.userId, userId)));
  });
}, "Could not update items. Please try again.");
