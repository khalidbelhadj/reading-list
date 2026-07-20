// Shared ResizeObserver hook for element-size reactions. Modes mirror
// use-window-resize: "sync" runs the handler on every observer callback;
// "raf" coalesces to at most one call per animation frame with the latest
// rect. For trailing-debounced width-as-state, use useDebouncedElementWidth
// (lib/use-debounced-resize.ts) instead.
// The handler is kept in a ref, so an unstable callback never re-observes.
import React from "react";

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
