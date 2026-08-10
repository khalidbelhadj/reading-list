// Shared window-resize listener with the three coalescing strategies used
// across the app. Pick the mode that matches how expensive the handler is:
// - "sync": runs on every resize event. For cheap direct-DOM writes that must
//   track the window per event (e.g. clamping a panel mid-resize).
// - "raf": at most one handler call per animation frame, with the trailing
//   event applied. For layout reads feeding setState at 60Hz+.
// - "debounce": trailing debounce (default 150ms) — only the settled size
//   applies. For expensive reactions (full re-renders, re-rasterization).
// The handler is kept in a ref, so an unstable callback never re-subscribes.
import React from "react";

const WINDOW_RESIZE_DEBOUNCE_MS = 150;

export type WindowResizeOptions = {
  mode: "sync" | "raf" | "debounce";
  // Debounce delay; "debounce" mode only. Defaults to 150ms.
  ms?: number;
};

export const useWindowResize = (
  onResize: () => void,
  { mode, ms = WINDOW_RESIZE_DEBOUNCE_MS }: WindowResizeOptions,
): void => {
  const onResizeRef = React.useRef(onResize);
  onResizeRef.current = onResize;

  React.useEffect(() => {
    let frame: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (mode === "sync") {
        onResizeRef.current();
        return;
      }
      if (mode === "raf") {
        if (frame !== null) return;
        frame = requestAnimationFrame(() => {
          frame = null;
          onResizeRef.current();
        });
        return;
      }
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onResizeRef.current();
      }, ms);
    };
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("resize", handler);
      if (frame !== null) cancelAnimationFrame(frame);
      if (timer !== null) clearTimeout(timer);
    };
  }, [mode, ms]);
};
