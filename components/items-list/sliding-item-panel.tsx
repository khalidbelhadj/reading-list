// SlidingItemPanel: the open/close/expand phase machine, the spacer + fixed
// visual-layer render, and the resize-drag plumbing (direct style writes).
// Sizing hooks live in panel-sizing.ts; the content layer in panel-inner.tsx.
import React from "react";

import { isOverlayOpen } from "@/lib/input-context";
import { EASE, SLIDE_OFFSET } from "@/lib/motion";
import { subscribePanelCommand } from "@/lib/panel-events";
import { useDismissLayer } from "@/lib/use-dismiss-layer";
import { usePanelResize } from "@/lib/use-panel-resize";
import { useWindowResize } from "@/lib/use-window-resize";
import { cn } from "@/lib/utils";

import { PanelInner } from "./panel-inner";
import {
  axisForOrientation,
  clampDesired,
  clampEffective,
  type Orientation,
  PANEL_SIZE_CONFIG,
  type ResizeAxis,
  useIsNarrow,
  usePanelSize,
  useViewportSize,
} from "./panel-sizing";

// Open phase machine. "closed" represents both "never opened" and "after
// slide-off"; while closed, the visual layer keeps the dimensions of the
// last open phase so the slide-off animation doesn't reshape content.
export type OpenPhase = "side" | "fullw";
export type Phase = "closed" | OpenPhase;

const WIDTH_MS = 280; // side ↔ fullw
const OPEN_MS = 280; // closed ↔ side (slide in/out)
// SLIDE_OFFSET (lib/motion) is the slide-off distance — how far the panel
// must translate to clear PanelLayout's outer padding (p-2) when it slides
// off-screen. It must match that padding, so the panel toolbar's buttons line
// up with the list toolbar's buttons.
// The resize handle is a strip centered over the boundary between the panel
// and the list — the SLIDE_OFFSET gap (side) or the top edge (bottom).
const HANDLE_SIZE = 16;

const PANEL_RADIUS = 8;

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

  // Expand: side ↔ fullw. Expanding stops at fullw so the panel keeps its
  // outer padding — edge-to-edge rendering only exists in the dedicated item
  // window (ItemWindow), which uses PanelInner with chrome="window".
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
      // The find bar owns its own Escape (it closes the bar via the dismiss
      // stack), so don't treat its focused input as a blur-first panel field.
      if (ae?.closest("[data-find-bar]")) return;
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

  // Resize drag: pointer moves mutate styles directly via refs (visual
  // panel, layout spacer, handle position) — zero React renders while
  // dragging. Desired size commits once, on drag end. Drags only happen in
  // the "side" phase (the handle is inert otherwise), so the direct writes
  // never fight the fullw viewport-derived sizes.
  const spacerRef = React.useRef<HTMLDivElement | null>(null);
  const handleRef = React.useRef<HTMLDivElement | null>(null);
  const dragBaselineRef = React.useRef({
    startCoordinate: 0,
    startSize: 0,
    desired: 0,
  });

  // Writes the effective side-phase size to the three drag-managed elements
  // (visual panel, layout spacer, handle position). Shared by the drag path
  // and the window-resize re-clamp below; only valid in the "side" phase,
  // where these are the exact properties React renders from sidePrimary.
  const applyEffectiveStyles = React.useCallback(
    (currentAxis: ResizeAxis, effective: number) => {
      if (currentAxis === "width") {
        if (visualRef.current) visualRef.current.style.width = `${effective}px`;
        if (spacerRef.current)
          spacerRef.current.style.width = `${effective + SLIDE_OFFSET}px`;
        if (handleRef.current)
          handleRef.current.style.right = `calc(${effective + SLIDE_OFFSET / 2}px + var(--reading-offset, 0px))`;
      } else {
        if (visualRef.current)
          visualRef.current.style.height = `${effective}px`;
        if (spacerRef.current)
          spacerRef.current.style.height = `${effective}px`;
        if (handleRef.current)
          handleRef.current.style.bottom = `${effective}px`;
      }
    },
    [],
  );

  const applyDragSize = React.useCallback(
    (coordinate: number) => {
      // Panel sits on the right (side) or bottom (bottom) edge — dragging
      // toward the opposite edge grows it. Desired absorbs the full delta
      // even if it exceeds the viewport cap, so the user's intent to
      // "max out" survives a transient window resize.
      const baseline = dragBaselineRef.current;
      const desired = clampDesired(
        axis,
        baseline.startSize + (baseline.startCoordinate - coordinate),
      );
      baseline.desired = desired;
      const viewportDim =
        axis === "width" ? window.innerWidth : window.innerHeight;
      applyEffectiveStyles(axis, clampEffective(axis, desired, viewportDim));
    },
    [axis, applyEffectiveStyles],
  );

  const commitDragSize = React.useCallback(
    (coordinate: number) => {
      // Re-apply from the final coordinate, then commit desired — the render
      // that follows computes the same effective size, so there's no visual
      // jump.
      applyDragSize(coordinate);
      setDesiredSize(dragBaselineRef.current.desired);
    },
    [applyDragSize, setDesiredSize],
  );

  // Per-event visual re-clamp while the window resizes. The viewport state
  // commit above is debounced, so without this a panel pinned at the
  // viewport cap would overflow the shrinking window for ~150ms. Direct
  // style writes (same channel as the drag) keep it clamped every event;
  // the debounced re-render then computes the identical effective size.
  // Side phase only — fullw sizes are viewport-relative calc() values
  // that track the window natively, and while closed the spacer must stay
  // at 0.
  const axisRef = React.useRef(axis);
  axisRef.current = axis;
  const desiredSizeRef = React.useRef({
    width: desiredWidth,
    height: desiredHeight,
  });
  desiredSizeRef.current = { width: desiredWidth, height: desiredHeight };
  useWindowResize(
    React.useCallback(() => {
      if (phaseRef.current !== "side") return;
      const currentAxis = axisRef.current;
      const viewportDim =
        currentAxis === "width" ? window.innerWidth : window.innerHeight;
      const effective = clampEffective(
        currentAxis,
        desiredSizeRef.current[currentAxis],
        viewportDim,
      );
      applyEffectiveStyles(currentAxis, effective);
    }, [applyEffectiveStyles]),
    { mode: "sync" },
  );

  const { dragging: isDraggingResize, startResize } = usePanelResize({
    axis: axis === "width" ? "x" : "y",
    onDrag: applyDragSize,
    onEnd: commitDragSize,
  });

  const handleResizeStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Drag baselines on the *effective* (rendered) size so the panel
      // responds immediately even if desired exceeds the viewport cap.
      dragBaselineRef.current = {
        startCoordinate: axis === "width" ? e.clientX : e.clientY,
        startSize: effectiveSize,
        desired: effectiveSize,
      };
      startResize(e);
    },
    [axis, effectiveSize, startResize],
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
  // Deliberately not debounced: suppression must start on the FIRST resize
  // event to be useful, and the repeated setResizing(true) calls bail out of
  // re-rendering (same value) — only the trailing reset renders.
  const [resizing, setResizing] = React.useState(false);
  const resizingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useWindowResize(
    React.useCallback(() => {
      setResizing(true);
      if (resizingTimerRef.current) clearTimeout(resizingTimerRef.current);
      resizingTimerRef.current = setTimeout(() => setResizing(false), 120);
    }, []),
    { mode: "sync" },
  );
  React.useEffect(
    () => () => {
      if (resizingTimerRef.current) clearTimeout(resizingTimerRef.current);
    },
    [],
  );

  const suppressTransitions =
    (phase === "closed" && orientationJustChanged) ||
    resizing ||
    isDraggingResize;

  // Primary axis size for the "side" phase. fullw sizes come from filling
  // the viewport rather than from this value.
  const sidePrimary =
    orientation === "side" ? `${panelWidth}px` : `${panelHeight}px`;

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
  const visualPosition: React.CSSProperties = (() => {
    if (orientation === "side") {
      // --reading-offset (set by the reading panel, 0 otherwise) shifts this
      // panel left so it sits beside the reading surface instead of under it.
      if (visualPhase === "fullw") {
        return {
          top: SLIDE_OFFSET,
          right: `calc(${SLIDE_OFFSET}px + var(--reading-offset, 0px))`,
          bottom: SLIDE_OFFSET,
          width: `calc(100vw - ${SLIDE_OFFSET * 2}px - var(--reading-offset, 0px))`,
        };
      }
      return {
        top: SLIDE_OFFSET,
        right: `calc(${SLIDE_OFFSET}px + var(--reading-offset, 0px))`,
        bottom: SLIDE_OFFSET,
        width: sidePrimary,
      };
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
        ref={spacerRef}
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
          borderRadius: PANEL_RADIUS,
          transform: visualTransform,
          transition: visualTransition,
          zIndex: 30,
        }}
      >
        {renderedId && (
          <PanelInner
            itemId={renderedId}
            onClose={onClose}
            chrome={phase === "fullw" ? "fullw" : "side"}
            findEnabled={phase !== "closed"}
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
          ref={handleRef}
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
                  // Centered over the SLIDE_OFFSET gap between list and
                  // panel. Tracks the panel, which itself shifts left of the
                  // reading panel via --reading-offset.
                  right: `calc(${panelWidth + SLIDE_OFFSET / 2}px + var(--reading-offset, 0px))`,
                  width: HANDLE_SIZE,
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
                  // No gap above the panel — straddle the boundary so the
                  // grab strip sits centered on the panel's top edge.
                  bottom: `${panelHeight}px`,
                  height: HANDLE_SIZE,
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
