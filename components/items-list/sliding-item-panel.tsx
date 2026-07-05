import {
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconDots,
  IconFileFilled,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import Image from "@/components/ui/image";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LoadingFade } from "@/components/ui/loading-fade";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isOverlayOpen } from "@/lib/input-context";
import { subscribePanelCommand } from "@/lib/panel-events";
import { fetchItems } from "@/lib/queries";
import { type Item } from "@/lib/types";
import { useDismissLayer } from "@/lib/use-dismiss-layer";
import { cn } from "@/lib/utils";

import { DeleteItemDialog } from "./delete-item-dialog";
import { DetailPanel } from "./detail-panel";
import { DetailPanelSkeleton } from "./detail-panel-skeleton";
import { FindBar } from "./find-bar";
import { ItemDropdown } from "./item-dropdown";
import { useItemMutations } from "./use-item-mutations";
import { usePanelFind } from "./use-panel-find";
import { getFaviconSrc, type EditFields } from "./utils";

// Open phase machine. "closed" represents both "never opened" and "after
// slide-off"; while closed, the visual layer keeps the dimensions of the
// last open phase so the slide-off animation doesn't reshape content.
export type OpenPhase = "side" | "fullw" | "full";
export type Phase = "closed" | OpenPhase;

const WIDTH_MS = 280; // side ↔ fullw
const OPEN_MS = 280; // closed ↔ side (slide in/out)
export const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
// Outer spacing is owned by PanelLayout (p-2). 8 here is the slide-off
// distance — how far the panel must translate to clear the layout's outer
// padding when it slides off-screen. Must match PanelLayout's padding so
// the panel toolbar's buttons line up with the list toolbar's buttons.
const SLIDE_OFFSET = 8;
const NARROW_BREAKPOINT = 768;

type Orientation = "side" | "bottom";
type ResizeAxis = "width" | "height";

// Side orientation resizes width (handle on the panel's left edge);
// bottom orientation resizes height (handle on the panel's top edge).
// Stored as separate localStorage keys so each axis remembers its own size.
const PANEL_SIZE_CONFIG: Record<
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
    min: 360,
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

const axisForOrientation = (o: Orientation): ResizeAxis =>
  o === "side" ? "width" : "height";

// Lower-bound clamp: only enforces the absolute min, ignores viewport.
// This is what gets persisted — captures the user's *desired* size. No
// upper bound here so a user who drags to "max" on a wide monitor records
// that intent even if they later open the app on a narrower one.
const clampDesired = (axis: ResizeAxis, value: number) => {
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
const clampEffective = (
  axis: ResizeAxis,
  desired: number,
  viewportDim: number,
) => {
  const cfg = PANEL_SIZE_CONFIG[axis];
  const viewportMax = Math.max(cfg.min, viewportDim - cfg.viewportGutter);
  return Math.max(cfg.min, Math.min(viewportMax, clampDesired(axis, desired)));
};

const useViewportSize = () => {
  const [size, setSize] = React.useState(() => {
    if (typeof window === "undefined") return { w: 1024, h: 768 };
    return { w: window.innerWidth, h: window.innerHeight };
  });
  React.useEffect(() => {
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
};

const usePanelSize = (axis: ResizeAxis) => {
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

const radiusFor = (p: OpenPhase) => (p === "full" ? 0 : 8);

const useIsNarrow = () => {
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

export const SlidingItemPanel = ({
  itemId,
  onClose,
  expanded = false,
  onExpandedChange,
}: {
  itemId: string | null;
  onClose: () => void;
  // Desired side(false) ↔ fullw(true) state, owned by the parent via the
  // ?expanded=1 URL param so expanded mode is deep-linkable. The panel reports
  // user-driven expand/restore back through onExpandedChange.
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) => {
  // Always start at "closed" so a remount with itemId already set still
  // plays the open animation (closed → side via rAF). Some parent re-mounts
  // happen on URL change.
  const [phase, setPhase] = React.useState<Phase>("closed");
  const [renderedId, setRenderedId] = React.useState<string | null>(null);

  // Remember the last open phase so the visual layer keeps its shape during
  // the slide-off animation (no reshape during close).
  const lastOpenPhaseRef = React.useRef<OpenPhase>("side");
  React.useEffect(() => {
    if (phase !== "closed") lastOpenPhaseRef.current = phase;
  }, [phase]);

  // Open: while phase=closed, an itemId triggers the open animation.
  // setTimeout rather than rAF so the next-tick callback survives the effect
  // cleanup that React fires on rapid re-renders.
  const openTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  React.useEffect(() => {
    if (!itemId) return;
    if (phase === "closed") {
      setRenderedId(itemId);
      if (openTimeoutRef.current === null) {
        openTimeoutRef.current = setTimeout(() => {
          openTimeoutRef.current = null;
          setPhase("side");
        }, 16);
      }
      return;
    }
    setRenderedId((prev) => (itemId !== prev ? itemId : prev));
  }, [itemId, phase]);
  React.useEffect(
    () => () => {
      if (openTimeoutRef.current !== null) {
        clearTimeout(openTimeoutRef.current);
        openTimeoutRef.current = null;
      }
    },
    [],
  );

  // Close: slide off via transform without reshaping content. Single-shot,
  // not dependent on phase so the cleanup doesn't clobber in-flight timers.
  const phaseRef = React.useRef(phase);
  React.useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  React.useEffect(() => {
    if (itemId) return;
    const startPhase = phaseRef.current;
    if (startPhase === "closed") return;
    setPhase("closed");
    const tUnmount = setTimeout(() => {
      // Slide-off is done and the panel is off-screen + empty. Forget the
      // phase we just closed from, so the *next* open starts at "side" width
      // instead of inheriting a stale "fullw" — otherwise reopening a new item
      // in preview mode flashes full-width and shrinks to side mid-slide-in.
      // (lastOpenPhaseRef exists only to preserve shape *during* slide-off.)
      lastOpenPhaseRef.current = "side";
      setRenderedId(null);
    }, OPEN_MS);
    return () => clearTimeout(tUnmount);
  }, [itemId]);

  // Expand: side ↔ fullw. The "full" (edge-to-edge) phase was removed —
  // expanding now stops at fullw so the panel keeps its outer padding.
  // Side ↔ fullw is owned by the URL (?expanded=1) and round-trips through the
  // parent. Each request optimistically flips the local phase for a snappy
  // animation and notifies the parent to update the URL; the parent feeds the
  // value back as the `expanded` prop, which the reconciliation effect below
  // treats as a no-op since the phase already matches.
  const requestExpanded = React.useCallback(
    (next: boolean) => {
      setPhase((p) => (p === "closed" ? p : next ? "fullw" : "side"));
      onExpandedChange?.(next);
    },
    [onExpandedChange],
  );

  const expand = React.useCallback(
    () => requestExpanded(true),
    [requestExpanded],
  );

  const restore = React.useCallback(
    () => requestExpanded(false),
    [requestExpanded],
  );

  // Reconcile the local phase with the URL-driven `expanded` flag. Runs after
  // the open animation settles on "side": if the URL says expanded, this is
  // what carries the panel on to "fullw" — deep-linking into expanded mode and
  // Cmd+Enter both flow through here. A no-op once the phase already matches,
  // so it never fights the optimistic flip in requestExpanded.
  //
  // Bail while there's no open item: closing from expanded mode clears `itemId`
  // and `expanded` in the same commit, and without this guard the `!expanded`
  // branch would flip "fullw" → "side", overriding the close effect's
  // "closed" and leaving the panel open on a blank (often just-deleted) item.
  React.useEffect(() => {
    if (!itemId || phase === "closed") return;
    if (expanded && phase === "side") setPhase("fullw");
    else if (!expanded && phase === "fullw") setPhase("side");
  }, [itemId, expanded, phase]);

  // ESC closes the panel via the dismiss stack (lib/dismiss-stack.ts): it's a
  // layer that's active whenever the panel is open, so Escape closes it in LIFO
  // order relative to search, transient edits, etc. `contains` lets re-focusing
  // the panel promote it back above an older layer (e.g. a still-open search).
  const visualRef = React.useRef<HTMLDivElement | null>(null);
  useDismissLayer({
    active: phase !== "closed",
    onDismiss: onClose,
    contains: (node) => visualRef.current?.contains(node) ?? false,
  });

  // First Escape inside a panel field (title/notes editor) just blurs it; the
  // panel itself only closes on the next Escape, once focus has left the field.
  // Runs in the capture phase so it consumes the event before the stack
  // dispatcher would otherwise close the panel.
  React.useEffect(() => {
    if (phase === "closed") return;
    const onKeyCapture = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isOverlayOpen()) return;
      const ae = document.activeElement as HTMLElement | null;
      const isEditable =
        ae &&
        (ae.tagName === "INPUT" ||
          ae.tagName === "TEXTAREA" ||
          ae.isContentEditable);
      if (isEditable && visualRef.current?.contains(ae)) {
        e.stopPropagation();
        ae.blur();
      }
    };
    document.addEventListener("keydown", onKeyCapture, true);
    return () => document.removeEventListener("keydown", onKeyCapture, true);
  }, [phase]);

  // Keyboard-driven view transitions, dispatched from the central shortcut
  // handler (Cmd+] / Cmd+[ / Cmd+K). Read the live phase from phaseRef so the
  // subscription doesn't need to re-bind on every phase change.
  React.useEffect(() => {
    return subscribePanelCommand((command) => {
      const current = phaseRef.current;
      if (command === "expand") {
        if (current === "side") requestExpanded(true);
      } else if (command === "peek") {
        if (current === "fullw") requestExpanded(false);
      } else if (command === "collapse") {
        if (current === "fullw") requestExpanded(false);
        else if (current === "side") onClose();
      }
    });
  }, [onClose, requestExpanded]);

  // Phase used to compute the *visual* layer's dimensions. While closed we
  // freeze on the last open phase so the slide-off keeps the same shape.
  const visualPhase: OpenPhase =
    phase === "closed" ? lastOpenPhaseRef.current : phase;

  const isNarrow = useIsNarrow();
  const orientation: Orientation = isNarrow ? "bottom" : "side";
  const axis = axisForOrientation(orientation);

  // Persist width and height independently so each orientation remembers
  // its own size. Effective sizes are re-clamped against the live viewport
  // on every render — desired stays put when the window shrinks, so the
  // panel re-expands when the window grows back.
  const [desiredWidth, setDesiredWidth] = usePanelSize("width");
  const [desiredHeight, setDesiredHeight] = usePanelSize("height");
  const viewport = useViewportSize();
  const panelWidth = clampEffective("width", desiredWidth, viewport.w);
  const panelHeight = clampEffective("height", desiredHeight, viewport.h);
  const effectiveSize = axis === "width" ? panelWidth : panelHeight;
  const setDesiredSize = axis === "width" ? setDesiredWidth : setDesiredHeight;
  const resetSize = React.useCallback(() => {
    const cfg = PANEL_SIZE_CONFIG[axis];
    setDesiredSize(cfg.default);
  }, [axis, setDesiredSize]);

  const [isDraggingResize, setIsDraggingResize] = React.useState(false);

  const handleResizeStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startCoord = axis === "width" ? e.clientX : e.clientY;
      // Drag baselines on the *effective* (rendered) size so the panel
      // responds immediately even if desired exceeds the viewport cap.
      const startSize = effectiveSize;
      const cursor = axis === "width" ? "col-resize" : "row-resize";
      setIsDraggingResize(true);
      const prevCursor = document.body.style.cursor;
      const prevUserSelect = document.body.style.userSelect;
      document.body.style.cursor = cursor;
      document.body.style.userSelect = "none";
      const onMove = (ev: PointerEvent) => {
        // Panel sits on the right (side) or bottom (bottom) edge — dragging
        // toward the opposite edge grows it. Desired absorbs the full delta
        // even if it exceeds the viewport cap, so the user's intent to
        // "max out" survives a transient window resize.
        const coord = axis === "width" ? ev.clientX : ev.clientY;
        setDesiredSize(startSize + (startCoord - coord));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevUserSelect;
        setIsDraggingResize(false);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [axis, effectiveSize, setDesiredSize],
  );

  // If the orientation flips while the panel is closed (user resized across
  // the breakpoint), suppress transitions for that frame — otherwise the
  // off-screen panel visibly animates across the screen as the transform
  // rotates from right-edge to bottom-edge.
  const prevOrientationRef = React.useRef(orientation);
  const orientationJustChanged = prevOrientationRef.current !== orientation;
  React.useLayoutEffect(() => {
    prevOrientationRef.current = orientation;
  }, [orientation]);

  // Window resize suppresses transitions: the panel's width/top/right/etc.
  // use vw/dvh values, so resizing makes the computed values change and the
  // CSS transition tries to animate every step, lagging behind the window.
  const [resizing, setResizing] = React.useState(false);
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      setResizing(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setResizing(false), 120);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const suppressTransitions =
    (phase === "closed" && orientationJustChanged) ||
    resizing ||
    isDraggingResize;

  // Primary axis size for the "side" phase. fullw/full sizes come from
  // filling the viewport rather than from this value.
  const sidePrimary =
    orientation === "side" ? `${panelWidth}px` : `${panelHeight}px`;
  const visualRadius = radiusFor(visualPhase);

  // Placeholder reserves flex space so the list shrinks to make room for the
  // panel in side mode. Frozen at the side size regardless of expand state —
  // when expanded, the visual layer overlays the list rather than pushing it.
  // In side orientation the +SLIDE_OFFSET bakes the visual gap between the list
  // and the panel into the placeholder, since PanelLayout has p-2 but no flex
  // gap. In bottom (narrow / vertical split) orientation the panel butts
  // directly against the main content, so there's no gap to reserve.
  const layoutGap = orientation === "side" ? SLIDE_OFFSET : 0;
  const layoutSize =
    phase === "closed" ? 0 : `calc(${sidePrimary} + ${layoutGap}px)`;

  // Animation durations per transition stage. Used both for the per-phase
  // size/position changes and for matching the toolbar's padding transition
  // inside PanelInner so the toolbar settles in sync.
  const ms = (() => {
    if (phase === "closed") return OPEN_MS;
    return WIDTH_MS;
  })();

  const sizeProp = orientation === "side" ? "width" : "height";
  const layoutTransition = suppressTransitions
    ? "none"
    : `${sizeProp} ${OPEN_MS}ms ${EASE}`;

  const visualTransition = suppressTransitions
    ? "none"
    : [
        `transform ${OPEN_MS}ms ${EASE}`,
        `top ${ms}ms ${EASE}`,
        `right ${ms}ms ${EASE}`,
        `bottom ${ms}ms ${EASE}`,
        `left ${ms}ms ${EASE}`,
        `width ${ms}ms ${EASE}`,
        `height ${ms}ms ${EASE}`,
        `border-radius ${ms}ms ${EASE}`,
      ].join(", ");

  const visualTransform =
    phase === "closed"
      ? orientation === "side"
        ? `translate3d(calc(100% + ${SLIDE_OFFSET}px), 0, 0)`
        : `translate3d(0, calc(100% + ${SLIDE_OFFSET}px), 0)`
      : "translate3d(0px, 0px, 0px)";

  // Fixed positioning relative to the viewport. Each phase has explicit,
  // viewport-anchored values so the panel animates its own dimensions/offsets
  // independently of any parent reflow — this avoids the stutter that
  // happened when the panel's size was driven by an animating parent.
  //
  //   side: panel sits in the corner with SLIDE_OFFSET breathing room
  //   fullw: panel fills the layout's padded area (still SLIDE_OFFSET in)
  //   full: panel goes edge-to-edge (SLIDE_OFFSET → 0)
  const visualPosition: React.CSSProperties = (() => {
    if (orientation === "side") {
      if (visualPhase === "full") {
        return { top: 0, right: 0, bottom: 0, width: "100vw" };
      }
      if (visualPhase === "fullw") {
        return {
          top: SLIDE_OFFSET,
          right: SLIDE_OFFSET,
          bottom: SLIDE_OFFSET,
          width: `calc(100vw - ${SLIDE_OFFSET * 2}px)`,
        };
      }
      return {
        top: SLIDE_OFFSET,
        right: SLIDE_OFFSET,
        bottom: SLIDE_OFFSET,
        width: sidePrimary,
      };
    }
    if (visualPhase === "full") {
      return { left: 0, right: 0, bottom: 0, height: "100dvh" };
    }
    if (visualPhase === "fullw") {
      return {
        left: SLIDE_OFFSET,
        right: SLIDE_OFFSET,
        bottom: SLIDE_OFFSET,
        height: `calc(100dvh - ${SLIDE_OFFSET * 2}px)`,
      };
    }
    return {
      left: SLIDE_OFFSET,
      right: SLIDE_OFFSET,
      bottom: SLIDE_OFFSET,
      height: sidePrimary,
    };
  })();

  return (
    <>
      {/* Layout placeholder — reserves flex space so the list shrinks to
          make room for the panel; animates to 0 on close. Invisible. */}
      <div
        aria-hidden
        className="flex-none"
        style={{
          width: orientation === "side" ? layoutSize : "auto",
          height: orientation === "bottom" ? layoutSize : "auto",
          transition: layoutTransition,
        }}
      />

      {/* Visual panel — fixed positioning so the panel's own transitions
          drive every visual change, with no dependency on parent layout. */}
      <div
        ref={visualRef}
        data-phase={phase}
        className={cn(
          "pointer-events-auto fixed flex flex-col overflow-hidden bg-surface",
          phase !== "closed" && "border border-border shadow-sm",
        )}
        style={{
          ...visualPosition,
          borderRadius: visualRadius,
          transform: visualTransform,
          transition: visualTransition,
          zIndex: 30,
        }}
      >
        {renderedId && (
          <PanelInner
            itemId={renderedId}
            onClose={onClose}
            phase={phase}
            onExpand={expand}
            onRestore={restore}
          />
        )}
      </div>

      {/* Resize handle — lives in the SLIDE_OFFSET gap between list and
          panel, not inside the panel itself. Follows the panel via the
          same slide transform so it appears/disappears with it. */}
      {(phase === "side" || phase === "closed") && (
        <div
          role="separator"
          aria-orientation={orientation === "side" ? "vertical" : "horizontal"}
          onPointerDown={handleResizeStart}
          onDoubleClick={resetSize}
          className={cn(
            "group/resize fixed z-40",
            orientation === "side" ? "cursor-col-resize" : "cursor-row-resize",
            phase === "closed" && "pointer-events-none",
          )}
          style={
            orientation === "side"
              ? {
                  top: SLIDE_OFFSET,
                  bottom: SLIDE_OFFSET,
                  right: `${SLIDE_OFFSET + panelWidth}px`,
                  width: SLIDE_OFFSET,
                  transform:
                    phase === "closed"
                      ? `translate3d(calc(100% + ${SLIDE_OFFSET}px), 0, 0)`
                      : "translate3d(0px, 0px, 0px)",
                  transition: suppressTransitions
                    ? "none"
                    : `transform ${OPEN_MS}ms ${EASE}, right ${OPEN_MS}ms ${EASE}`,
                }
              : {
                  left: SLIDE_OFFSET,
                  right: SLIDE_OFFSET,
                  // No gap above the panel anymore — straddle the boundary so
                  // the grab handle sits centered on the panel's top edge.
                  bottom: `${panelHeight + SLIDE_OFFSET / 2}px`,
                  height: SLIDE_OFFSET,
                  transform:
                    phase === "closed"
                      ? `translate3d(0, calc(100% + ${SLIDE_OFFSET}px), 0)`
                      : "translate3d(0px, 0px, 0px)",
                  transition: suppressTransitions
                    ? "none"
                    : `transform ${OPEN_MS}ms ${EASE}, bottom ${OPEN_MS}ms ${EASE}`,
                }
          }
        >
          <div
            className={cn(
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[opacity,background-color] duration-150",
              orientation === "side" ? "h-10 w-0.75" : "h-0.75 w-10",
              isDraggingResize
                ? "bg-foreground/70 opacity-100"
                : "bg-muted-foreground/50 opacity-0 group-hover/resize:opacity-100",
            )}
          />
        </div>
      )}
    </>
  );
};

export const PanelInner = ({
  itemId,
  onClose,
  phase,
  onExpand,
  onRestore,
  // "panel" is the sliding side panel; "window" is a dedicated single-item
  // window (ItemWindow) that drops the close/collapse affordances — the window
  // *is* the item, so there's nothing to close or restore to.
  variant = "panel",
}: {
  itemId: string;
  onClose: () => void;
  phase: Phase;
  onExpand?: () => void;
  onRestore?: () => void;
  variant?: "panel" | "window";
}) => {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });
  const liveItem = items?.find((i) => i.id === itemId) ?? null;

  // Hold onto the last-seen item so the panel keeps rendering its content
  // during the close animation after an optimistic delete removes the item
  // from the cache. Reset when the panel switches to a different itemId.
  const [snapshot, setSnapshot] = React.useState<Item | null>(liveItem);
  React.useEffect(() => {
    setSnapshot(null);
  }, [itemId]);
  React.useEffect(() => {
    if (liveItem) setSnapshot(liveItem);
  }, [liveItem]);
  const item = liveItem ?? snapshot;

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const morphRef = React.useRef<HTMLDivElement | null>(null);
  const headerSlotRef = React.useRef<HTMLDivElement | null>(null);

  const faviconSrc = item
    ? getFaviconSrc({ faviconUrl: item.faviconUrl, url: item.url })
    : null;

  // The scroll container persists across items, so opening a *different* item
  // would otherwise inherit the previous one's scroll offset — and a stuck
  // top fade. Reset both to the top when the item id changes. Keyed on id (not
  // the item object) so editing the current item doesn't jump the scroll.
  React.useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (scrollEl) scrollEl.scrollTop = 0;
    setScrolled(false);
  }, [item?.id]);

  // Title morph: as the user scrolls the panel's inner container, the title
  // row in the content interpolates toward the empty slot in the toolbar,
  // shrinking and fading from content position into the header.
  React.useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const THRESHOLD = 48;
    const CONTENT_ICON = 24;
    const HEADER_ICON = 14;
    const CONTENT_FONT = 20; // text-xl on the title in DetailPanel
    const HEADER_FONT = 12;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const ease = (t: number) => t * (2 - t);

    const update = () => {
      const morph = morphRef.current;
      const headerSlot = headerSlotRef.current;
      const contentRow =
        scrollEl.querySelector<HTMLElement>("[data-title-row]");
      const containingBlock = morph?.parentElement;
      if (!morph || !headerSlot || !contentRow || !containingBlock) return;

      const panelRect = containingBlock.getBoundingClientRect();
      const scrollY = Math.max(0, scrollEl.scrollTop);
      const rawT = Math.min(scrollY / THRESHOLD, 1);
      const t = ease(rawT);

      // React bails out of the re-render when the value is unchanged, so a
      // direct set is correct and avoids the stale effect-local guard that
      // left the fade stuck on after navigating to an unscrolled item.
      setScrolled(scrollY > 0);

      if (rawT <= 0) {
        morph.style.opacity = "0";
        contentRow.style.visibility = "";
        return;
      }

      contentRow.style.visibility = "hidden";

      const contentRect = contentRow.getBoundingClientRect();
      const headerRect = headerSlot.getBoundingClientRect();
      const x = lerp(
        contentRect.left - panelRect.left,
        headerRect.left - panelRect.left,
        t,
      );
      const y = lerp(
        contentRect.top - panelRect.top,
        headerRect.top - panelRect.top,
        t,
      );
      const iconSize = lerp(CONTENT_ICON, HEADER_ICON, t);
      const fontSize = lerp(CONTENT_FONT, HEADER_FONT, t);
      const gap = lerp(8, 6, t);
      const maxWidth = lerp(contentRect.width, headerRect.width, t);

      morph.style.transform = `translate(${x}px, ${y}px)`;
      morph.style.fontSize = `${fontSize}px`;
      morph.style.gap = `${gap}px`;
      morph.style.maxWidth = `${maxWidth}px`;
      morph.style.opacity = "1";

      const icon = morph.querySelector<HTMLElement>("[data-morph-icon]");
      if (icon) {
        icon.style.width = `${iconSize}px`;
        icon.style.height = `${iconSize}px`;
      }
    };

    update();
    scrollEl.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const raf = requestAnimationFrame(update);
    return () => {
      scrollEl.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
      const contentRow =
        scrollEl.querySelector<HTMLElement>("[data-title-row]");
      if (contentRow) contentRow.style.visibility = "";
    };
  }, [item]);

  const {
    toggleReadMutation,
    togglePinMutation,
    toggleHiddenFromReviewMutation,
    deleteMutation,
    updateMutation,
  } = useItemMutations();

  const handleSave = React.useCallback(
    (id: string, fields: EditFields) => {
      const tagNames = fields.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      updateMutation.mutate({
        itemId: id,
        fields: {
          title: fields.title,
          url: fields.url,
          notes: fields.notes,
          tagNames,
        },
      });
    },
    [updateMutation],
  );

  const handleTogglePin = React.useCallback(() => {
    if (!item) return;
    togglePinMutation.mutate({ itemId: item.id, starred: !item.starred });
  }, [item, togglePinMutation]);

  const handleToggleRead = React.useCallback(() => {
    if (!item) return;
    toggleReadMutation.mutate({ itemId: item.id, read: !item.read });
  }, [item, toggleReadMutation]);

  const handleToggleHiddenFromReview = React.useCallback(() => {
    if (!item) return;
    toggleHiddenFromReviewMutation.mutate({
      itemId: item.id,
      hiddenFromReview: !item.hiddenFromReview,
    });
  }, [item, toggleHiddenFromReviewMutation]);

  const handleDelete = React.useCallback(() => {
    if (!item) return;
    setDeleteOpen(false);
    onClose();
    deleteMutation.mutate(item.id);
  }, [item, deleteMutation, onClose]);

  const isExpanded = phase === "full" || phase === "fullw";

  const find = usePanelFind({ scrollRef, enabled: phase !== "closed" });

  return (
    <>
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center gap-0.5 bg-inherit p-1 transition-[padding] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)]",
          // In "full" mode the panel has lost its outer margins, so put the
          // same inset back as internal padding — the buttons stay at the
          // same absolute position as the margin animates away.
          phase === "full" && "pt-3 pr-3 pl-3",
          // The panel toolbar is always a window drag region in Electron
          // (you can grab anywhere along the top bar to move the window).
          "electron-top-bar-inset",
          // Reserve macOS traffic-light space once the panel starts covering
          // the top-left of the window. `panel-toolbar` forces the 80px
          // clearance regardless of viewport width (see globals.css). In
          // side mode the panel is on the right edge and doesn't need it.
          (phase === "fullw" || phase === "full") && "panel-toolbar",
        )}
      >
        {variant === "panel" && (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    onClick={onClose}
                  />
                }
              >
                <IconX />
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    onClick={isExpanded ? onRestore : onExpand}
                  />
                }
              >
                {isExpanded ? (
                  <IconArrowsDiagonalMinimize2 />
                ) : (
                  <IconArrowsDiagonal />
                )}
              </TooltipTrigger>
              <TooltipContent>
                {isExpanded ? "Restore" : "Expand"}
              </TooltipContent>
            </Tooltip>
          </>
        )}
        <div ref={headerSlotRef} className="ml-1 h-5 flex-1" />
        {item?.hiddenFromReview && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge variant="secondary" className="mr-0.5">
                  Hidden from review
                </Badge>
              }
            />
            <TooltipContent>
              This item&apos;s flashcards are excluded from your review queue
            </TooltipContent>
          </Tooltip>
        )}
        {item?.read && (
          <Badge variant="secondary" className="mr-0.5">
            Read
          </Badge>
        )}
        {item ? (
          <ItemDropdown
            item={item}
            onTogglePin={handleTogglePin}
            onToggleRead={handleToggleRead}
            onToggleHiddenFromReview={handleToggleHiddenFromReview}
            onDelete={() => setDeleteOpen(true)}
          >
            <Tooltip>
              <DropdownMenuTrigger
                render={
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                      />
                    }
                  >
                    <IconDots />
                  </TooltipTrigger>
                }
              />
              <TooltipContent>More options</TooltipContent>
            </Tooltip>
          </ItemDropdown>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            disabled
          >
            <IconDots />
          </Button>
        )}
        <div
          className={cn(
            "pointer-events-none absolute right-0 bottom-0 left-0 h-8 translate-y-full bg-linear-to-b from-surface to-transparent transition-opacity duration-200",
            scrolled ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      <FindBar find={find} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-175 flex-col px-3 pt-1 pb-12">
          <LoadingFade
            loading={!item}
            skeleton={<DetailPanelSkeleton />}
            className="flex flex-1 flex-col"
          >
            {item ? (
              <DetailPanel
                key={item.id}
                item={item}
                onSave={handleSave}
                onDelete={() => setDeleteOpen(true)}
              />
            ) : null}
          </LoadingFade>
        </div>
      </div>

      {item && (
        <div
          ref={morphRef}
          className="pointer-events-none absolute top-0 left-0 z-20 flex items-center"
          style={{ opacity: 0 }}
        >
          <div
            data-morph-icon
            className="flex shrink-0 items-center justify-center"
            style={{ width: 24, height: 24 }}
          >
            {faviconSrc ? (
              <Image
                src={faviconSrc}
                alt=""
                width={24}
                height={24}
                className="h-full w-full rounded object-contain"
                unoptimized
              />
            ) : (
              <IconFileFilled className="h-full w-full text-muted-foreground" />
            )}
          </div>
          <span className="truncate font-content font-semibold">
            {item.title || "Untitled"}
          </span>
        </div>
      )}

      <DeleteItemDialog
        item={item}
        open={deleteOpen}
        deleting={false}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
      />
    </>
  );
};
