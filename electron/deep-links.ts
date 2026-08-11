// readinglist:// deep links. Owns the one-slot queue for a link that arrives
// before the window can receive it (cold start: the OS dispatches open-url
// while the renderer is still loading).
//
// The target window is always a parameter, never an import — that keeps the
// dependency edge one-directional (windows → deep-links) instead of a cycle.
import type { BrowserWindow } from "electron";

import { APP_CHANNELS } from "./channels";

let pendingDeepLink: string | null = null;

const raise = (win: BrowserWindow) => {
  if (win.isMinimized()) win.restore();
  win.focus();
};

/** Deliver now if the window is ready, otherwise queue for the flush below. */
export const deliverDeepLink = (win: BrowserWindow | null, url: string) => {
  if (win && !win.webContents.isLoading()) {
    win.webContents.send(APP_CHANNELS.deepLink, url);
    raise(win);
    return;
  }
  pendingDeepLink = url;
  if (win) win.focus();
};

/** Called from the main window's did-finish-load. */
export const flushPendingDeepLink = (win: BrowserWindow) => {
  if (!pendingDeepLink) return;
  win.webContents.send(APP_CHANNELS.deepLink, pendingDeepLink);
  pendingDeepLink = null;
};
