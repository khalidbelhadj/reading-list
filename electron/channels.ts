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

// Main process ↔ app renderer (electron/main.ts ↔ electron/preload.ts).
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
} as const;
