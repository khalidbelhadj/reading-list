// The reading panel: slides in from the right edge of the main layout and
// hosts the viewer (toolbar + stage) for one item. Mirrors the sliding item
// panel's pattern — an invisible flex spacer reserves layout room while the
// visual panel is fixed-positioned — so the list shrinks instead of being
// covered, and the item panel sits to this panel's left (offset via the
// --reading-offset variable PanelLayout sets). Notes never live inside this
// panel: they're the regular item panel (docked) or the floating card.
import React from "react";

import { pushDismissLayer } from "@/lib/dismiss-stack";
import { EASE, SLIDE_MS, SLIDE_OFFSET } from "@/lib/motion";
import { type Item } from "@/lib/types";
import { usePanelResize } from "@/lib/use-panel-resize";
import { useSlideIn } from "@/lib/use-slide-in";
import { useWindowResize } from "@/lib/use-window-resize";
import { cn } from "@/lib/utils";

import { ViewerHeader } from "./viewer-header";
import { openExternally, ViewerStage } from "./viewer-stage";

// The resize handle is a strip centered over the SLIDE_OFFSET gap between
// this panel and whatever sits to its left — the gap IS the grab area.
const HANDLE_WIDTH = 16;
const PANEL_MIN = 420;
// Room this panel must leave free on the left. While reading, the item panel
// is the fullw panel sized by `100vw - 16px - var(--reading-offset)`, so this
// is effectively that panel's minimum width.
const PANEL_KEEP_FREE = 320;
// Expand/restore animation for the panel's left/width edges.
const EXPAND_MS = 280;

const clampWidth = (width: number, viewportWidth: number) =>
  Math.min(
    Math.max(PANEL_MIN, width),
    Math.max(PANEL_MIN, viewportWidth - PANEL_KEEP_FREE),
  );

export const ReadingPanel = ({
  item,
  panelWidth,
  onPanelWidthChange,
  onClose,
  expanded,
  onExpandedChange,
}: {
  item: Item;
  panelWidth: number;
  onPanelWidthChange: (width: number) => void;
  onClose: () => void;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
}) => {
  const [width, setWidth] = React.useState(() =>
    clampWidth(
      panelWidth,
      typeof window === "undefined" ? 1400 : window.innerWidth,
    ),
  );

  const preferredWidthRef = React.useRef(panelWidth);
  preferredWidthRef.current = panelWidth;

  // Slide in on mount (see lib/use-slide-in.ts for the choreography).
  const { entered, settled } = useSlideIn(SLIDE_MS);

  // Report the panel's occupied width so PanelLayout can offset the item
  // panel (via --reading-offset) and reserve layout space.
  const occupied = width + SLIDE_OFFSET;

  // The item panel is fixed-positioned against the viewport's right edge —
  // publish this panel's occupied width as a document-level variable so it
  // (and anything else fixed on the right) shifts left of us.
  //
  // Expanding does NOT touch this — the item panel keeps its place and this
  // panel simply grows over it (see the z-index note on the visual panel).
  React.useEffect(() => {
    document.documentElement.style.setProperty(
      "--reading-offset",
      `${occupied}px`,
    );
    return () => {
      document.documentElement.style.removeProperty("--reading-offset");
    };
  }, [occupied]);

  const handleOpenExternal = React.useCallback(() => {
    openExternally(item.url);
  }, [item.url]);

  // Escape via the app's dismiss stack (lib/dismiss-stack.ts). The item
  // panel registers its layer a frame after mount (its open animation), so a
  // plain mount-time push would land UNDER it and Escape would close notes
  // before the reader. Register after a short delay so the reader starts on
  // top; later interactions promote whichever panel was touched last (the
  // stack's focus rule), which is the intended recency behavior.
  const panelRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  React.useEffect(() => {
    if (!settled) return;
    return pushDismissLayer(() => onCloseRef.current(), {
      contains: (node) => panelRef.current?.contains(node) ?? false,
    });
  }, [settled]);

  // Resize drag: pointer moves mutate styles directly via refs (panel width,
  // layout spacer, --reading-offset, handle position) — zero React renders
  // while dragging. State + settings commit once, on drag end.
  const spacerRef = React.useRef<HTMLDivElement>(null);
  const handleRef = React.useRef<HTMLDivElement>(null);
  // Read through a ref so the callbacks below keep a stable identity.
  const expandedRef = React.useRef(expanded);
  expandedRef.current = expanded;

  // The one place that pushes a width to the DOM without a render. Shared by
  // the drag and the window-resize re-clamp so both move the same four things
  // in lockstep — the item panel's fullw width is a calc() over
  // --reading-offset, so writing that here is what keeps it glued to us.
  const applyWidth = React.useCallback((nextWidth: number) => {
    const nextOccupied = nextWidth + SLIDE_OFFSET;
    if (panelRef.current) panelRef.current.style.width = `${nextWidth}px`;
    if (spacerRef.current) spacerRef.current.style.width = `${nextOccupied}px`;
    if (handleRef.current)
      handleRef.current.style.right = `${nextWidth + SLIDE_OFFSET / 2}px`;
    document.documentElement.style.setProperty(
      "--reading-offset",
      `${nextOccupied}px`,
    );
  }, []);

  // Window resize: re-clamp every event via direct writes so the panel tracks
  // the window edge live. The state commit is debounced separately — it
  // re-renders the whole viewer, which is far too expensive per event.
  //
  // `windowResizing` kills the expand/restore transition for the duration:
  // otherwise every re-clamp animates over EXPAND_MS and the panel visibly
  // lags the window edge (the item panel beside us has no such transition,
  // so the two would drift apart mid-resize).
  const [windowResizing, setWindowResizing] = React.useState(false);
  const resizingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useWindowResize(
    React.useCallback(() => {
      setWindowResizing(true);
      if (resizingTimerRef.current) clearTimeout(resizingTimerRef.current);
      resizingTimerRef.current = setTimeout(
        () => setWindowResizing(false),
        120,
      );
      // Expanded, the panel is sized by its left/right insets — pure CSS,
      // already tracking the window. Writing a width here would pin it.
      if (expandedRef.current) return;
      applyWidth(clampWidth(preferredWidthRef.current, window.innerWidth));
    }, [applyWidth]),
    { mode: "sync" },
  );
  React.useEffect(
    () => () => {
      if (resizingTimerRef.current) clearTimeout(resizingTimerRef.current);
    },
    [],
  );
  useWindowResize(
    React.useCallback(() => {
      setWidth(clampWidth(preferredWidthRef.current, window.innerWidth));
    }, []),
    { mode: "debounce" },
  );

  const applyDragWidth = React.useCallback(
    (clientX: number) => {
      // While expanded there is no handle, but guard anyway: a stale pointer
      // stream must not reintroduce an inline width on the full-bleed panel.
      if (expandedRef.current)
        return panelRef.current?.offsetWidth ?? PANEL_MIN;
      const nextWidth = clampWidth(
        window.innerWidth - clientX - SLIDE_OFFSET,
        window.innerWidth,
      );
      applyWidth(nextWidth);
      return nextWidth;
    },
    [applyWidth],
  );
  const commitDragWidth = React.useCallback(
    (clientX: number) => {
      // Re-apply from the final coordinate, then commit — the
      // occupied-width effect re-asserts the same --reading-offset value,
      // so there's no visual jump.
      const finalWidth = applyDragWidth(clientX);
      setWidth(finalWidth);
      onPanelWidthChange(finalWidth);
    },
    [applyDragWidth, onPanelWidthChange],
  );
  const { dragging, startResize } = usePanelResize({
    onDrag: applyDragWidth,
    onEnd: commitDragWidth,
  });

  const handleToggleExpanded = React.useCallback(() => {
    onExpandedChange(!expanded);
  }, [expanded, onExpandedChange]);

  // Always right-anchored with an explicit width — expanded just means that
  // width is the whole padded row. Never set `left`: animating it from `auto`
  // can't interpolate, so the panel would jump instead of easing.
  const panelWidthStyle = expanded
    ? `calc(100vw - ${SLIDE_OFFSET * 2}px)`
    : width;

  return (
    <>
      {/* Layout spacer — reserves room so the list + item panel shrink
          instead of being covered. */}
      <div
        ref={spacerRef}
        aria-hidden
        className="flex-none"
        style={{ width: occupied }}
      />

      {/* Visual panel — fixed so its slide/resize never reflows the list. */}
      <div
        ref={panelRef}
        // This panel is z-[35], above the item panel's z-30: expanding grows
        // it leftward over the stationary item panel rather than pushing it
        // aside. They never overlap while restored, so a constant z is enough.
        className={cn(
          "pointer-events-auto fixed z-[35] flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm",
          // Only an expanded reader reaches the window's top-left, so only it
          // needs the engine toolbar aligned under the traffic lights.
          expanded && "reader-expanded",
        )}
        style={{
          top: SLIDE_OFFSET,
          right: SLIDE_OFFSET,
          bottom: SLIDE_OFFSET,
          width: panelWidthStyle,
          transform: entered
            ? "translate3d(0,0,0)"
            : `translate3d(calc(100% + ${SLIDE_OFFSET}px),0,0)`,
          transition:
            dragging || windowResizing
              ? undefined
              : settled
                ? `width ${EXPAND_MS}ms ${EASE}`
                : `transform ${SLIDE_MS}ms ${EASE}`,
        }}
      >
        <ViewerHeader
          fallbackUrl={item.url}
          onClose={onClose}
          onOpenExternal={handleOpenExternal}
          expanded={expanded}
          onToggleExpanded={handleToggleExpanded}
        />
        <ViewerStage item={item} />
      </div>

      {/* Resize handle — a strip centered over the SLIDE_OFFSET gap on the
          panel's left (the gap between panels IS the handle; the panel's own
          overflow-hidden would clip it, so it's a fixed sibling). Slides in
          alongside the panel: both travel width + SLIDE_OFFSET px. */}
      {!expanded && (
        <div
          ref={handleRef}
          role="separator"
          aria-orientation="vertical"
          onPointerDown={startResize}
          className="group/resize fixed z-40 cursor-col-resize"
          style={{
            top: SLIDE_OFFSET,
            bottom: SLIDE_OFFSET,
            right: width + SLIDE_OFFSET / 2,
            width: HANDLE_WIDTH,
            transform: entered
              ? "translate3d(0,0,0)"
              : `translate3d(${width + SLIDE_OFFSET}px,0,0)`,
            transition:
              dragging || settled
                ? undefined
                : `transform ${SLIDE_MS}ms ${EASE}`,
          }}
        >
          <div
            className={cn(
              "absolute top-1/2 left-1/2 h-10 w-0.75 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[opacity,background-color] duration-150",
              dragging
                ? "bg-foreground/70 opacity-100"
                : "bg-muted-foreground/50 opacity-0 group-hover/resize:opacity-100",
            )}
          />
        </div>
      )}
    </>
  );
};
