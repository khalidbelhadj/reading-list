import { contextBridge, ipcRenderer } from "electron";

// Type-only: the preload runs sandboxed, where require() of sibling modules
// fails at runtime and silently kills the whole script (no bridge, no
// html.electron class, no vibrancy). Channel names are therefore written as
// literals, but `channel()` checks each one against APP_CHANNELS at compile
// time so they can't drift.
import type { APP_CHANNELS } from "./channels";

type AppChannel = (typeof APP_CHANNELS)[keyof typeof APP_CHANNELS];
const channel = <C extends AppChannel>(name: C): C => name;

contextBridge.exposeInMainWorld("readingList", {
  platform: "electron" as const,
  openExternal: (url: string) =>
    ipcRenderer.invoke(channel("open-external"), url),
  onDeepLink: (cb: (url: string) => void) => {
    const listener = (_event: unknown, url: string) => cb(url);
    ipcRenderer.on(channel("deep-link"), listener);
    return () => {
      ipcRenderer.off(channel("deep-link"), listener);
    };
  },
  getZoomFactor: (): Promise<number> =>
    ipcRenderer.invoke(channel("zoom-current")),
  // Open browser tabs. The main process only polls while at least one renderer
  // is subscribed, so the returned teardown genuinely stops the work.
  onBrowserTabs: (cb: (tabs: unknown[]) => void) => {
    const listener = (_event: unknown, tabs: unknown[]) => cb(tabs);
    ipcRenderer.on(channel("browser-tabs"), listener);
    void ipcRenderer.invoke(channel("browser-tabs-subscribe"));
    return () => {
      ipcRenderer.off(channel("browser-tabs"), listener);
      void ipcRenderer.invoke(channel("browser-tabs-unsubscribe"));
    };
  },
  focusBrowserTab: (ref: unknown): Promise<void> =>
    ipcRenderer.invoke(channel("browser-tabs-focus"), ref),
  setVibrancy: (
    enabled: boolean,
    appearance?: "light" | "dark",
  ): Promise<void> =>
    ipcRenderer.invoke(channel("set-vibrancy"), enabled, appearance),
  onZoomChange: (cb: (zoom: number) => void) => {
    const listener = (_event: unknown, zoom: number) => cb(zoom);
    ipcRenderer.on(channel("zoom"), listener);
    return () => {
      ipcRenderer.off(channel("zoom"), listener);
    };
  },
});

// Tag the document so CSS can reserve a left buffer for the macOS traffic
// lights without a hydration flicker.
window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("electron");
});
