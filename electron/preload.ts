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
});

// Tag the document so CSS can reserve a left buffer for the macOS traffic
// lights without a hydration flicker.
window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("electron");
});
