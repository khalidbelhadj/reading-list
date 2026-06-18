import { type Item } from "@/lib/types";

export { relativeTime } from "@/lib/format-time";

export type Density = "compact" | "cozy";

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
