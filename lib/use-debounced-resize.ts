// 150ms trailing-debounce resize tracking shared by the viewer surfaces.
// Continuous resizes (panel drag, window resize) fire every tick, and the
// reactions are expensive (PDF re-rasterization at DPR, full-panel
// re-renders), so only the settled size applies.
import React from "react";

import { useWindowResize } from "@/lib/use-window-resize";

const RESIZE_DEBOUNCE_MS = 150;

// Content-box width of `ref`'s element via ResizeObserver. The first
// measurement applies immediately (initial layout needs the real width);
// subsequent measurements are debounced trailing, so consumers keep their
// last-settled size mid-resize and react once after the resize settles.
export const useDebouncedElementWidth = (
  ref: React.RefObject<HTMLElement | null>,
): number => {
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    let hasMeasured = false;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = entry.contentRect.width;
      if (!hasMeasured) {
        hasMeasured = true;
        setWidth(next);
        return;
      }
      if (debounceTimeout !== null) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        debounceTimeout = null;
        setWidth(next);
      }, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(element);
    return () => {
      if (debounceTimeout !== null) clearTimeout(debounceTimeout);
      observer.disconnect();
    };
  }, [ref]);

  return width;
};

// Run `onResize` once after window resize events go quiet. Thin alias over
// useWindowResize with this file's shared debounce interval.
export const useDebouncedWindowResize = (onResize: () => void): void => {
  useWindowResize(onResize, { mode: "debounce", ms: RESIZE_DEBOUNCE_MS });
};
