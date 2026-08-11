// OS appearance → window background + renderer broadcast.
import { BrowserWindow, nativeTheme } from "electron";

import { APP_CHANNELS } from "./channels";

// Approximations of --background tokens from app/globals.css. Used as the
// window background color so fast resizes don't expose a white (or dark)
// strip that mismatches the page until React paints.
const LIGHT_BG = "#fcfbf9";
const DARK_BG = "#1a1a17";

export const themeBg = () =>
  nativeTheme.shouldUseDarkColors ? DARK_BG : LIGHT_BG;

/**
 * Chromium's matchMedia("(prefers-color-scheme: dark)") doesn't fire its
 * "change" listener when the macOS appearance flips while the app is running.
 * nativeTheme.on("updated", ...) is the authoritative signal — forward it to
 * every renderer so the theme follows the OS live, and keep each window's
 * background color in sync so resizes don't flash.
 *
 * Registered before app-ready so an appearance flip during startup isn't missed.
 */
export const watchNativeTheme = () => {
  nativeTheme.on("updated", () => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.setBackgroundColor(themeBg());
      win.webContents.send(
        APP_CHANNELS.nativeTheme,
        nativeTheme.shouldUseDarkColors,
      );
    }
  });
};
