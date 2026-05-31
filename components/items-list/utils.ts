import { type Item } from "@/lib/types";

export { relativeTime } from "@/lib/format-time";

export type ViewMode = "compact" | "cozy";

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

export function getFaviconSrc(item: Pick<Item, "faviconUrl" | "url">): string | null {
  if (item.faviconUrl) return item.faviconUrl;
  try {
    const domain = new URL(item.url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}
