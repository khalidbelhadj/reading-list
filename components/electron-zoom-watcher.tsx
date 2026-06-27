"use client";

import React from "react";

// Mounted once near the app root (no-op outside the desktop app). The Electron
// main process owns the page zoom factor and broadcasts it whenever it changes
// (keyboard or wheel zoom). We mirror it into a `--zoom` CSS variable so the
// toolbar's traffic-light clearance can widen as the page zooms out — the
// native window buttons are a fixed physical size and don't shrink with zoom,
// so the CSS gap must grow (gap = clearance / zoom) to keep clearing them.
export const ElectronZoomWatcher = () => {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const bridge = window.readingList;
    // Feature-detect each method: the desktop shell loads this web app remotely
    // and ships its own preload, so an older installed binary may expose
    // `readingList` without the zoom methods added in a later release.
    if (
      !bridge ||
      typeof bridge.getZoomFactor !== "function" ||
      typeof bridge.onZoomChange !== "function"
    )
      return;
    const apply = (zoom: number) => {
      document.documentElement.style.setProperty("--zoom", String(zoom));
    };
    // Sync the current value on mount (covers HMR remounts that miss the last
    // broadcast), then subscribe to subsequent changes.
    bridge
      .getZoomFactor()
      .then(apply)
      .catch(() => {});
    return bridge.onZoomChange(apply);
  }, []);

  return null;
};
