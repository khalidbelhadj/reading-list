import type { BrowserTab, BrowserTabRef } from "@/electron/channels";

export {};

declare global {
  interface Window {
    readingList?: {
      platform: "electron";
      openExternal: (url: string) => Promise<boolean>;
      onDeepLink: (cb: (url: string) => void) => () => void;
      getZoomFactor: () => Promise<number>;
      onZoomChange: (cb: (zoom: number) => void) => () => void;
      // Subscribing is what makes the main process poll; the teardown stops it.
      onBrowserTabs: (cb: (tabs: BrowserTab[]) => void) => () => void;
      focusBrowserTab: (ref: BrowserTabRef) => Promise<void>;
      setVibrancy: (
        enabled: boolean,
        appearance?: "light" | "dark",
      ) => Promise<void>;
    };
  }
}
