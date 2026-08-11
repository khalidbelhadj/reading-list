// Window creation and the shared webPreferences. Owns `mainWindow`; read it
// through getMainWindow() rather than importing the binding.
import { BrowserWindow } from "electron";

import { flushPendingDeepLink } from "./deep-links";
import { appUrl, iconPath, preloadPath } from "./env";
import { themeBg } from "./theme";
import {
  BASE_TRAFFIC_LIGHT_INSET,
  getZoomFactor,
  trafficLightInset,
} from "./zoom";

let mainWindow: BrowserWindow | null = null;

export const getMainWindow = () => mainWindow;

const sharedWebPreferences = () => ({
  preload: preloadPath(),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  // The in-app viewer (/read/:itemId) embeds arbitrary web pages in a
  // <webview>. Hardened per-attach in the will-attach-webview handler
  // (web-contents.ts).
  webviewTag: true,
});

/**
 * Options for a window opened by the renderer via window.open. Item windows
 * (?window=1) open narrow, framing the item's reading column rather than the
 * full list-width app.
 */
export const childWindowOptions = (isItemWindow: boolean) => ({
  width: isItemWindow ? 600 : 1000,
  height: isItemWindow ? 820 : 760,
  minWidth: 400,
  minHeight: 400,
  titleBarStyle: "hiddenInset" as const,
  trafficLightPosition: {
    x: trafficLightInset(getZoomFactor()),
    y: trafficLightInset(getZoomFactor()),
  },
  backgroundColor: themeBg(),
  icon: iconPath("icon.png"),
  webPreferences: sharedWebPreferences(),
});

export const createMainWindow = () => {
  // Note the asymmetry with childWindowOptions: the main window opens at the
  // base inset because it is created before any zoom has been applied.
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 400,
    minHeight: 400,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: {
      x: BASE_TRAFFIC_LIGHT_INSET,
      y: BASE_TRAFFIC_LIGHT_INSET,
    },
    backgroundColor: themeBg(),
    icon: iconPath("icon.png"),
    webPreferences: sharedWebPreferences(),
  });

  // Distinct from the did-finish-load in web-contents.ts (which re-asserts zoom
  // on every window): this one is the main window's deep-link flush only.
  mainWindow.webContents.on("did-finish-load", () => {
    if (mainWindow) flushPendingDeepLink(mainWindow);
  });

  mainWindow.loadURL(appUrl());

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};
