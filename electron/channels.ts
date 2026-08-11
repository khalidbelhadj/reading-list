// IPC channel names + the viewer RPC method union, shared by the Electron
// main process, the preloads, and the app renderer (webview engine). Keep
// this module dependency-free: it's compiled into both the electron build
// (electron/tsconfig.json) and the web bundle.

// Host renderer ↔ viewer <webview> guest (components/viewer/webview-engine.tsx ↔
// electron/viewer-preload.ts).
export const VIEWER_CHANNELS = {
  /** Host → guest: RPC request `{ id, method }`. */
  request: "viewer:request",
  /** Guest → host: RPC response `{ id, result }`. */
  response: "viewer:response",
  /** Guest → host: element-picker result `{ rect, text }`. */
  nodePicked: "viewer:node-picked",
} as const;

// Methods the viewer preload answers over VIEWER_CHANNELS.request.
export type ViewerRpcMethod =
  | "getState"
  | "getVisibleText"
  | "getSelection"
  | "extract"
  | "startNodePicker";

// Main process ↔ app renderer (electron/ipc.ts + friends ↔ electron/preload.ts).
export const APP_CHANNELS = {
  /** invoke: open a URL in the system browser. */
  openExternal: "open-external",
  /** invoke: raise the calling window. */
  focusWindow: "focus-window",
  /** invoke: read the current app-wide zoom factor. */
  zoomCurrent: "zoom-current",
  /** main → renderer: zoom factor changed. */
  zoom: "zoom",
  /** main → renderer: a readinglist:// deep link arrived. */
  deepLink: "deep-link",
  /** invoke: read nativeTheme.shouldUseDarkColors. */
  nativeThemeCurrent: "native-theme-current",
  /** main → renderer: the OS theme flipped. */
  nativeTheme: "native-theme",
  /** invoke: start receiving browser-tab pushes on this renderer. */
  browserTabsSubscribe: "browser-tabs-subscribe",
  /** invoke: stop receiving browser-tab pushes on this renderer. */
  browserTabsUnsubscribe: "browser-tabs-unsubscribe",
  /** main → renderer: the set of open browser tabs changed. */
  browserTabs: "browser-tabs",
  /** invoke: raise a browser tab (`BrowserTabRef`). */
  browserTabsFocus: "browser-tabs-focus",
} as const;

/**
 * One tab open in a local Chromium browser, as read by
 * electron/browser-tabs.ts. Local-only: this never crosses the network.
 */
export type BrowserTab = {
  url: string;
  /** This is the frontmost tab of its window — "you're looking at this". */
  active: boolean;
  /** Scripting name of the owning app, e.g. "Google Chrome". */
  app: string;
  /** Display name for menus, e.g. "Chrome". */
  browser: string;
  /**
   * Opaque per-browser tab handle, used to raise the tab later. Chromium
   * browsers use their own stable tab id (positional indices shift as tabs are
   * opened, closed or dragged); Safari has no such id, so it uses the URL.
   */
  tabId: string;
};

/** Enough to address a tab for raising it. */
export type BrowserTabRef = Pick<BrowserTab, "app" | "tabId">;
