// Client-only helpers for multi-window flows. On the web a "window" is a
// browser tab; in Electron the main process intercepts window.open for
// app-origin URLs (electron/main.ts setWindowOpenHandler) and creates a real
// child window instead. Either way the secondary window keeps window.opener
// pointing at the window that spawned it, which is what routes "show this
// item" requests back to the original window — no platform branching needed.

export const OPEN_ITEM_MESSAGE = "readinglist:open-item";

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

// Open an item in this window's side panel, mirroring PanelLayout's URL
// contract: it owns the ?item= param and listens for popstate. Outside the
// home route there's no PanelLayout, so fall back to a full navigation.
export const openItemInPanel = (itemId: string) => {
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

// Open the item expanded in its own window (Electron) / tab (web). Named per
// item so re-opening the same item reuses its window instead of stacking
// duplicates.
export const openItemInNewWindow = (itemId: string) => {
  const win = window.open(
    absoluteUrl(`/?item=${encodeURIComponent(itemId)}&expanded=1`),
    `item-${itemId}`,
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
  openItemInPanel(itemId);
};
