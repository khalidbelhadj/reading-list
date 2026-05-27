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

export const getYouTubeVideoId = (raw: string): string | null => {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id && /^[\w-]{11}$/.test(id) ? id : null;
      }
      const shortsMatch = url.pathname.match(/^\/shorts\/([\w-]{11})/);
      if (shortsMatch) return shortsMatch[1];
      const embedMatch = url.pathname.match(/^\/embed\/([\w-]{11})/);
      if (embedMatch) return embedMatch[1];
    }
    return null;
  } catch {
    return null;
  }
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

