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
