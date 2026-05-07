import { type Item } from "@/lib/types";

export type EditFields = {
  title: string;
  url: string;
  tags: string;
  notes: string;
};

export function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

export function resolveRowItem(
  item: Item,
  typingTitle: string | undefined,
  selectedId: string | null,
  liveFields: { title: string; url: string; notes: string; tags: string[] } | null,
): Item {
  if (typingTitle !== undefined) return { ...item, title: typingTitle };
  if (selectedId === item.id && liveFields) {
    return {
      ...item,
      title: liveFields.title,
      url: liveFields.url,
      notes: liveFields.notes,
      tags: liveFields.tags.map((name, i) => ({
        id: i,
        name,
        userId: item.userId,
      })),
    };
  }
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
