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
    if (typeof window === "undefined" || !window.readingList) return;
    const apply = (zoom: number) => {
      document.documentElement.style.setProperty("--zoom", String(zoom));
    };
    // Sync the current value on mount (covers HMR remounts that miss the last
    // broadcast), then subscribe to subsequent changes.
    window.readingList.getZoomFactor().then(apply);
    return window.readingList.onZoomChange(apply);
  }, []);

  return null;
};
