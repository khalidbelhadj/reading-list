// Sizing model for the sliding item panel: persisted desired sizes per axis,
// viewport-aware clamping, and the viewport/narrow-breakpoint hooks.
import React from "react";

import { useWindowResize } from "@/lib/use-window-resize";

const NARROW_BREAKPOINT = 768;

export type Orientation = "side" | "bottom";
export type ResizeAxis = "width" | "height";

// Side orientation resizes width (handle on the panel's left edge);
// bottom orientation resizes height (handle on the panel's top edge).
// Stored as separate localStorage keys so each axis remembers its own size.
export const PANEL_SIZE_CONFIG: Record<
  ResizeAxis,
  {
    storageKey: string;
    min: number;
    default: number;
    // Minimum room the rest of the viewport must keep on that axis. For
    // width, this protects the list column toolbar (settings menu, Review
    // group, Add button) and the macOS traffic-light inset from squishing.
    // This is also the *only* upper bound — there's no absolute max, so on
    // wide monitors the panel can grow as large as the viewport allows.
    viewportGutter: number;
  }
> = {
  width: {
    storageKey: "panel-width",
    min: 300,
    default: 520,
    viewportGutter: 400,
  },
  height: {
    storageKey: "panel-height",
    min: 320,
    default: 520,
    viewportGutter: 240,
  },
};

export const axisForOrientation = (o: Orientation): ResizeAxis =>
  o === "side" ? "width" : "height";

// Lower-bound clamp: only enforces the absolute min, ignores viewport.
// This is what gets persisted — captures the user's *desired* size. No
// upper bound here so a user who drags to "max" on a wide monitor records
// that intent even if they later open the app on a narrower one.
export const clampDesired = (axis: ResizeAxis, value: number) => {
  const cfg = PANEL_SIZE_CONFIG[axis];
  return Math.max(cfg.min, value);
};

// Effective clamp: applied at render time. Layers the viewport gutter on
// top of the absolute clamp. Computed from desired on every render so the
// panel re-expands when the window grows back — the desired value isn't
// destructively shrunk by a transient narrow window.
//
// Pass the live viewport dimension explicitly (read from state, not
// window.innerWidth) so React re-renders this on every resize event
// instead of going stale until something else triggers a render.
export const clampEffective = (
  axis: ResizeAxis,
  desired: number,
  viewportDim: number,
) => {
  const cfg = PANEL_SIZE_CONFIG[axis];
  const viewportMax = Math.max(cfg.min, viewportDim - cfg.viewportGutter);
  return Math.max(cfg.min, Math.min(viewportMax, clampDesired(axis, desired)));
};

export const useViewportSize = () => {
  const [size, setSize] = React.useState(() => {
    if (typeof window === "undefined") return { w: 1024, h: 768 };
    return { w: window.innerWidth, h: window.innerHeight };
  });
  // Debounced: each setState here re-renders the whole panel, so commit once
  // after resize events go quiet. Per-event visual re-clamping during the
  // resize is handled by direct style writes in SlidingItemPanel (see the
  // re-clamp resize effect there), so nothing looks stale in the meantime.
  useWindowResize(
    () => setSize({ w: window.innerWidth, h: window.innerHeight }),
    { mode: "debounce", ms: 150 },
  );
  return size;
};

export const usePanelSize = (axis: ResizeAxis) => {
  const cfg = PANEL_SIZE_CONFIG[axis];
  const [desired, setDesiredState] = React.useState<number>(() => {
    if (typeof window === "undefined") return cfg.default;
    const stored = window.localStorage.getItem(cfg.storageKey);
    const parsed = stored ? parseInt(stored, 10) : NaN;
    return clampDesired(axis, Number.isFinite(parsed) ? parsed : cfg.default);
  });
  const setDesired = React.useCallback(
    (next: number) => {
      setDesiredState(clampDesired(axis, next));
    },
    [axis],
  );
  React.useEffect(() => {
    window.localStorage.setItem(cfg.storageKey, String(desired));
  }, [cfg.storageKey, desired]);
  return [desired, setDesired] as const;
};

export const useIsNarrow = () => {
  // Read matchMedia synchronously in the initializer so the panel knows
  // the correct orientation on its very first client render — otherwise
  // the open animation starts in side orientation, then mid-flight flips
  // to bottom when the post-mount effect catches up. SSR still returns
  // false (window undefined), but the panel is closed during SSR so
  // there's no visible orientation to mismatch.
  const [isNarrow, setIsNarrow] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${NARROW_BREAKPOINT - 1}px)`).matches;
  });
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT - 1}px)`);
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isNarrow;
};
