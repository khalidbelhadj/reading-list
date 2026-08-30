export type DuplicateItem = {
  id: string;
  title: string;
  url: string;
  faviconUrl: string | null;
};

export const sanitizeRedirect = (next: string | undefined | null): string => {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  )
    return "/";
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
    // Tolerate trailing slashes on the path (e.g. /watch/, /embed/ID/,
    // youtu.be/ID/) — otherwise the exact "/watch" match below drops the
    // preview for any URL with a trailing slash.
    const path = url.pathname.replace(/\/+$/, "");
    if (host === "youtu.be") {
      const id = path.slice(1).split("/")[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (path === "/watch") {
        const id = url.searchParams.get("v");
        return id && /^[\w-]{11}$/.test(id) ? id : null;
      }
      const shortsMatch = path.match(/^\/shorts\/([\w-]{11})/);
      if (shortsMatch?.[1]) return shortsMatch[1];
      const embedMatch = path.match(/^\/embed\/([\w-]{11})/);
      if (embedMatch?.[1]) return embedMatch[1];
    }
    return null;
  } catch {
    return null;
  }
};

// Query params that identify a campaign/referrer rather than the page itself.
// Stripped when building a match key so a link saved from a newsletter still
// matches the same page open in a browser tab.
const TRACKING_PARAMS = [
  /^utm_/,
  /^mc_/,
  /^_hs/,
  /^(fbclid|gclid|gbraid|wbraid|msclkid|igshid|mkt_tok|ref|ref_src|source|si)$/,
];

const isTrackingParam = (name: string) =>
  TRACKING_PARAMS.some((pattern) => pattern.test(name));

/**
 * A canonical key for "is this the same page?" — used to match reading-list
 * items against open browser tabs (lib/open-tabs.ts).
 *
 * Deliberately more aggressive than normalizeUrl (which stays conservative
 * because it feeds duplicate *detection* on save): protocol, `www.`, trailing
 * slash, hash and tracking params are all dropped, and remaining params are
 * sorted so ordering doesn't matter. Meaningful params are kept — `?v=` is
 * what distinguishes two YouTube videos — so this collapses noise, not
 * identity.
 *
 * Returns null for anything that isn't an http(s) URL (chrome://,
 * about:blank, file:// — never a reading-list item).
 */
export const urlMatchKey = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // YouTube is the common case where the same video has many URL shapes
  // (youtu.be, /shorts, /embed, extra playlist params) — collapse them all.
  const videoId = getYouTubeVideoId(trimmed);
  if (videoId) return `youtube:${videoId}`;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    for (const name of [...url.searchParams.keys()]) {
      if (isTrackingParam(name)) url.searchParams.delete(name);
    }
    url.searchParams.sort();

    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path}${url.search}`;
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
