import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("readingList", {
  platform: "electron" as const,
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  onDeepLink: (cb: (url: string) => void) => {
    const listener = (_event: unknown, url: string) => cb(url);
    ipcRenderer.on("deep-link", listener);
    return () => {
      ipcRenderer.off("deep-link", listener);
    };
  },
  getNativeTheme: (): Promise<boolean> =>
    ipcRenderer.invoke("native-theme-current"),
  onNativeThemeChange: (cb: (dark: boolean) => void) => {
    const listener = (_event: unknown, dark: boolean) => cb(dark);
    ipcRenderer.on("native-theme", listener);
    return () => {
      ipcRenderer.off("native-theme", listener);
    };
  },
  getZoomFactor: (): Promise<number> => ipcRenderer.invoke("zoom-current"),
  onZoomChange: (cb: (zoom: number) => void) => {
    const listener = (_event: unknown, zoom: number) => cb(zoom);
    ipcRenderer.on("zoom", listener);
    return () => {
      ipcRenderer.off("zoom", listener);
    };
  },
});

// Tag the document so CSS can reserve a left buffer for the macOS traffic
// lights without a hydration flicker.
window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("electron");
});
