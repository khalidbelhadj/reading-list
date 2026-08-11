// Constants and path helpers for the main process. Every other electron/
// module imports from here, and nothing here does anything on import beyond
// defining values.
import path from "node:path";

import { app } from "electron";

const DEV_URL = process.env.ELECTRON_DEV_URL ?? "http://localhost:3000";
const PROD_URL = "https://reading-list.khalidbelhadj.com";
export const PROTOCOL = "readinglist";

export const isDev = !app.isPackaged;

// The dev server's port doubles as a per-instance id: each dev window targets
// its own port, so keying identity off the port lets arbitrarily many dev
// instances run side by side (separate userData, separate single-instance
// lock, separate window) with zero per-instance bookkeeping.
export const devPort = (() => {
  try {
    return new URL(DEV_URL).port || "3000";
  } catch {
    return "3000";
  }
})();

export const appUrl = () => (isDev ? DEV_URL : PROD_URL);

// Resolve icon paths relative to the project root regardless of where the
// compiled main.js lives (dist-electron/ in dev, resources/app/ when packaged).
export const iconPath = (file: string) =>
  path.join(app.getAppPath(), "electron", "assets", file);

// The preloads sit next to the compiled main process, so both paths are
// __dirname-relative — and __dirname mirrors the source tree. Keeping every
// electron/ module in one flat directory is what makes that true: nest one
// into a subdirectory and its __dirname gains a segment, the preload silently
// fails to load, and the app degrades to web mode with no error anywhere.
export const preloadPath = () => path.join(__dirname, "preload.js");
export const viewerPreloadPath = () =>
  path.join(__dirname, "viewer-preload.js");
