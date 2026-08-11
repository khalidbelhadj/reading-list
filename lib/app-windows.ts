// Client-only helpers for multi-window flows. On the web a "window" is a
// browser tab; in Electron the main process intercepts window.open for
// app-origin URLs (electron/web-contents.ts setWindowOpenHandler) and creates a real
// child window instead. Either way the secondary window keeps window.opener
// pointing at the window that spawned it, which is what routes "show this
// item" requests back to the original window — no platform branching needed.

const OPEN_ITEM_MESSAGE = "readinglist:open-item";

type OpenItemMessage = { type: typeof OPEN_ITEM_MESSAGE; itemId: string };

export const parseOpenItemMessage = (data: unknown): string | null => {
  if (typeof data !== "object" || data === null) return null;
  const message = data as Partial<OpenItemMessage>;
  if (message.type !== OPEN_ITEM_MESSAGE) return null;
  return typeof message.itemId === "string" && message.itemId
    ? message.itemId
    : null;
};

// Secondary windows are navigated via absolute URLs: a review placeholder
// starts on about:blank, where relative paths have no base to resolve against.
const absoluteUrl = (path: string) =>
  new URL(path, window.location.origin).toString();

// True when this window is a dedicated single-item window (opened via
// openItemInNewWindow with ?window=1). Such windows render only the item and
// have no side panel, so item-open requests must route back to the opener.
export const isItemWindow = () =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("window") != null;

// Show the item in this window's side panel, mirroring PanelLayout's URL
// contract: it owns the ?item= param and listens for popstate. Outside the
// home route there's no PanelLayout, so fall back to a full navigation.
const openItemHere = (itemId: string) => {
  if (window.location.pathname !== "/") {
    window.location.assign(`/?item=${encodeURIComponent(itemId)}`);
    return;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get("item") === itemId) return;
  params.set("item", itemId);
  window.history.pushState(null, "", `?${params.toString()}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

// Public entry point for "open this item in the panel". A dedicated item
// window has no panel, so it hands the request off to the window that opened
// it (the central window) instead of trying to open a panel that isn't there.
export const openItemInPanel = (itemId: string) => {
  if (isItemWindow()) {
    openItemInOriginWindow(itemId);
    return;
  }
  openItemHere(itemId);
};

// Open the item in its own window (Electron) / tab (web), showing only that
// item edge-to-edge with no list or panel chrome (?window=1 — read by
// PanelLayout). Named per item so re-opening the same item reuses its window
// instead of stacking duplicates.
export const openItemInNewWindow = (itemId: string) => {
  const win = window.open(
    absoluteUrl(`/?item=${encodeURIComponent(itemId)}&window=1`),
    `item-${itemId}`,
    // Narrow, tall — framing the item's reading column. In Electron the main
    // process sizes the window (setWindowOpenHandler); these features size the
    // popup on the web.
    "width=600,height=820",
  );
  win?.focus();
};

// Reviews run in their own window, opened synchronously inside the user's
// click — popup blockers kill window.open calls made after an await, so
// callers open this blank placeholder first and point it at the session once
// the server has created it. Returns null when the popup was blocked.
export const openReviewWindowPlaceholder = (): Window | null => {
  const win = window.open("about:blank", "review");
  if (win) {
    // Paint the placeholder in the app background so it doesn't flash white
    // in dark mode while the session is being created.
    try {
      win.document.documentElement.style.backgroundColor = getComputedStyle(
        document.body,
      ).backgroundColor;
    } catch {}
  }
  return win;
};

export const navigateWindowTo = (win: Window, path: string) => {
  win.location.href = absoluteUrl(path);
  win.focus();
};

// From a secondary window: show the item in the window that opened this one
// (received by WindowMessageWatcher there). If that window is gone — or this
// window was never opened from another one — open the item here instead.
export const openItemInOriginWindow = (itemId: string) => {
  const opener = window.opener as Window | null;
  if (opener && !opener.closed) {
    const message: OpenItemMessage = { type: OPEN_ITEM_MESSAGE, itemId };
    opener.postMessage(message, window.location.origin);
    // Best effort on the web (browsers rarely let a tab raise another); in
    // Electron the receiving window raises itself via the focus-window IPC.
    try {
      opener.focus();
    } catch {}
    return;
  }
  // No opener to hand off to. A dedicated item window has no panel, so adopt
  // the item by navigating this window into the central layout; anywhere else
  // (e.g. a review window at /review/...), open it here.
  if (isItemWindow()) {
    window.location.assign(`/?item=${encodeURIComponent(itemId)}`);
    return;
  }
  openItemHere(itemId);
};
