// Shared helpers for talking to the reading-list app.
// Auth rides the user's existing Supabase cookie session (credentials: include),
// so there's no separate login in the extension — just be signed in on the web app.

export const PRODUCTION_URL = "https://reading-list.khalidbelhadj.com";
const DEFAULT_DEV_URL = "http://localhost:3000";
// Where "Open in reading list" sends the user: "web" (a browser tab) or "app"
// (the desktop app, via its readinglist:// protocol handler).
const DEFAULT_OPEN_IN = "web";

const trim = (url) => url.replace(/\/+$/, "");

// Returns { devMode, appUrl, openIn } as stored (appUrl is the dev override).
export const getSettings = async () => {
  const {
    devMode = false,
    appUrl = DEFAULT_DEV_URL,
    openIn = DEFAULT_OPEN_IN,
  } = await chrome.storage.sync.get(["devMode", "appUrl", "openIn"]);
  return { devMode, appUrl, openIn };
};

export const setSettings = async ({ devMode, appUrl, openIn }) => {
  await chrome.storage.sync.set({ devMode, appUrl: trim(appUrl), openIn });
};

// The effective base url: the dev override when dev mode is on, else production.
export const getAppUrl = async () => {
  const { devMode, appUrl } = await getSettings();
  return trim(devMode && appUrl ? appUrl : PRODUCTION_URL);
};

// --- saved-state cache -----------------------------------------------------
// The popup used to block on a network lookup before it could render *any*
// button. It now renders from this cache immediately and revalidates in the
// background, so opening the popup is instant in the common case.
//
// Keys are a rough client-side normalization (drop the hash, lowercase the
// host) — enough to hit for the same page revisited, while the server stays
// the authority on what counts as a duplicate. chrome.storage.session clears
// on browser restart, which is the right lifetime for a cache we can rebuild.
export const cacheKey = (url) => {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    return `item:${parsed.toString()}`;
  } catch {
    return `item:${url}`;
  }
};

// How long a cached lookup is trusted without re-asking the server. Bounds the
// request rate when someone cycles through tabs, which fires a lookup per
// activation otherwise.
export const CACHE_TTL_MS = 5 * 60 * 1000;

// Cached lookup result: { item, fetchedAt } where item is the saved row or
// null. Returns undefined when we've never looked this url up.
export const readCache = async (url) => {
  const key = cacheKey(url);
  const stored = await chrome.storage.session.get(key);
  return stored[key];
};

export const isFresh = (cached) =>
  !!cached && Date.now() - (cached.fetchedAt ?? 0) < CACHE_TTL_MS;

export const writeCache = async (url, item) => {
  await chrome.storage.session.set({
    [cacheKey(url)]: { item, fetchedAt: Date.now() },
  });
};

export const itemUrl = (appUrl, itemId) =>
  `${appUrl}/?item=${encodeURIComponent(itemId)}`;

// Deep link the desktop app's readinglist:// protocol handler resolves to a
// specific item. The renderer (deep-link-item-watcher) selects it.
export const itemDeepLink = (itemId) =>
  `readinglist://item/${encodeURIComponent(itemId)}`;

// Open a saved item in a new tab, honoring the user's "open in" preference:
// the desktop app (via readinglist://) or the web app.
export const openItem = async (appUrl, itemId) => {
  const { openIn } = await getSettings();
  const url = openIn === "app" ? itemDeepLink(itemId) : itemUrl(appUrl, itemId);
  await chrome.tabs.create({ url });
};

// Look up whether the given url is already saved. Returns { item, appUrl }
// where item is { id, title, url, faviconUrl } or null.
// Throws { code } on auth/network/server failures, like saveItem.
export const lookupItem = async (url) => {
  const appUrl = await getAppUrl();
  let res;
  try {
    res = await fetch(
      `${appUrl}/api/extension/items?url=${encodeURIComponent(url)}`,
      { credentials: "include" },
    );
  } catch {
    throw { code: "network", appUrl };
  }
  if (res.status === 401) throw { code: "auth", appUrl };
  if (!res.ok) throw { code: "server", appUrl, status: res.status };
  const data = await res.json();
  return { item: data.item ?? null, appUrl };
};

// POST to the app's extension endpoint. Returns the parsed CreateItemResult
// ({ ok: true, itemId } | { ok: false, duplicate }) plus an `appUrl` for links.
// Throws { code: "auth" } on 401 so callers can prompt the user to sign in.
export const saveItem = async ({
  url,
  title,
  faviconUrl,
  allowDuplicateUrl,
}) => {
  const appUrl = await getAppUrl();
  let res;
  try {
    res = await fetch(`${appUrl}/api/extension/items`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, title, faviconUrl, allowDuplicateUrl }),
    });
  } catch {
    throw { code: "network", appUrl };
  }
  if (res.status === 401) throw { code: "auth", appUrl };
  if (!res.ok) throw { code: "server", appUrl, status: res.status };
  const data = await res.json();
  return { ...data, appUrl };
};
