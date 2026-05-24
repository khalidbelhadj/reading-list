export type DuplicateItem = {
  id: string;
  title: string;
  url: string;
  faviconUrl: string | null;
};

export const sanitizeRedirect = (next: string | undefined | null): string => {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  try {
    const url = new URL(next, "http://dummy");
    if (url.hostname !== "dummy") return "/";
  } catch {
    return "/";
  }
  return next;
};

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

