import { type Item } from "@/lib/types";

export type Density = "compact" | "cozy";

// Item ids are UUIDs, which never occur in a title/url/notes — so a query
// containing one or more is unambiguously an "id lookup" (paste an id or a list
// of ids). Keying off this shape keeps it out of the way of normal searches.
const ITEM_ID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export const isIdSearch = (query: string): boolean =>
  query.match(ITEM_ID_RE) !== null;

// Every UUID in the query, lowercased, in order of appearance (deduped).
export const extractItemIds = (query: string): string[] => {
  const matches = query.match(ITEM_ID_RE);
  if (!matches) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const match of matches) {
    const id = match.toLowerCase();
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
};

export type EditFields = {
  title: string;
  url: string;
  tags: string;
  notes: string;
};

export function resolveRowItem(
  item: Item,
  typingTitle: string | undefined,
): Item {
  if (typingTitle !== undefined) return { ...item, title: typingTitle };
  return item;
}

/**
 * Builds a placeholder `Item` for optimistic insertion into the `["items"]`
 * cache right after a create, so the new row shows up before the refetch lands.
 * `userId` is borrowed from any existing cached item; tag placeholders get
 * negative ids (real ids arrive on invalidation).
 */
export function makeOptimisticItem(
  id: string,
  existing: Item[],
  fields: { title?: string; url?: string; tagNames?: string[] } = {},
): Item {
  const now = new Date().toISOString();
  const userId = existing[0]?.userId ?? "";
  return {
    id,
    userId,
    title: fields.title ?? "",
    url: fields.url ?? "",
    faviconUrl: null,
    starred: false,
    notes: null,
    read: false,
    readAt: null,
    hiddenFromReview: false,
    createdAt: now,
    updatedAt: now,
    tags: (fields.tagNames ?? []).map((name, i) => ({
      id: -(i + 1),
      userId,
      name,
    })),
    flashcardCount: 0,
  };
}

export function getFaviconSrc(
  item: Pick<Item, "faviconUrl" | "url">,
): string | null {
  if (item.faviconUrl) return item.faviconUrl;
  try {
    const domain = new URL(item.url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}
