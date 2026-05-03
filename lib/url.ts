import type { Item } from "@/lib/types";

export const normalizeUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return null;
  }
};

export const findDuplicateItem = (
  items: Item[] | undefined,
  rawUrl: string,
): Item | null => {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized || !items) return null;
  for (const item of items) {
    if (normalizeUrl(item.url) === normalized) return item;
  }
  return null;
};
