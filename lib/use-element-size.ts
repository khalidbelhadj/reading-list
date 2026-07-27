// Shared ResizeObserver hooks for element-size reactions. Modes mirror
// use-window-resize: "sync" runs the handler on every observer callback;
// "raf" coalesces to at most one call per animation frame with the latest
// rect. For trailing-debounced width-as-state, use useDebouncedElementWidth
// at the bottom of this file.
// The handler is kept in a ref, so an unstable callback never re-observes.
import React from "react";

import { WINDOW_RESIZE_DEBOUNCE_MS } from "@/lib/use-window-resize";

export type ElementSizeOptions = {
  mode: "sync" | "raf";
  // When false, no observer is attached (and any pending frame from a prior
  // attach is cancelled). Lets conditional effects stay hook-shaped.
  enabled?: boolean;
  // When true, the handler also runs synchronously on attach with the
  // element's current bounding rect — for consumers that need an initial
  // measurement before the observer's first (async) delivery.
  immediate?: boolean;
};

export const useElementSize = (
  ref: React.RefObject<HTMLElement | null>,
  onResize: (rect: DOMRectReadOnly) => void,
  { mode, enabled = true, immediate = false }: ElementSizeOptions,
): void => {
  const onResizeRef = React.useRef(onResize);
  onResizeRef.current = onResize;

  React.useEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;
    if (immediate) onResizeRef.current(element.getBoundingClientRect());
    let frame: number | null = null;
    let latest: DOMRectReadOnly | null = null;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      if (mode === "sync") {
        onResizeRef.current(entry.contentRect);
        return;
      }
      // rAF-coalesced: keep the latest rect and apply it in at most one
      // pending frame, so continuous resizes cost one handler call per frame.
      latest = entry.contentRect;
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (latest) onResizeRef.current(latest);
      });
    });
    observer.observe(element);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref, mode, enabled, immediate]);
};

// Content-box width of `ref`'s element as state. The first measurement applies
// immediately (initial layout needs the real width); subsequent measurements
// are debounced trailing, so consumers keep their last-settled size mid-resize
// and react once after it settles. Separate from useElementSize because the
// reactions here are expensive enough to want state, not a callback — PDF
// re-rasterization at DPR, full-panel re-renders.
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
      }, WINDOW_RESIZE_DEBOUNCE_MS);
    });
    observer.observe(element);
    return () => {
      if (debounceTimeout !== null) clearTimeout(debounceTimeout);
      observer.disconnect();
    };
  }, [ref]);

  return width;
};
