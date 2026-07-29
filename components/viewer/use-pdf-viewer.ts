// The PDF viewer controller: scale, rotation, the visible page window, and
// scroll anchoring. Everything the chrome and the page list read comes from
// here.
//
// Two decisions carry the whole thing's smoothness:
//
//  * **Scroll does not re-render.** The scroll position lives in a ref; React
//    state only holds the *page window* (first/last page to mount) and the
//    current page number. Scrolling within a page is therefore pure browser
//    scrolling with zero React work — a render happens only when the window
//    actually changes.
//  * **Display scale and render scale are separate.** `scale` moves with the
//    gesture, frame by frame; `renderScale` is the settled value the
//    rasterizer works at. Between the two, pages are CSS-scaled bitmaps the
//    compositor stretches for free, so a pinch never waits on pdf.js.
import React from "react";

import {
  buildPdfLayout,
  contentHeight,
  fitScale,
  pageIndexAt,
  pageSize,
  pageTop,
  type PdfLayout,
  type PdfMetrics,
  type PdfPageSize,
  visibleRange,
} from "@/lib/viewer/pdf-layout";

const PAGE_GAP = 14;
const STAGE_PADDING = 20;
const MIN_SCALE = 0.25;
const MAX_SCALE = 6;
// Pages either side of the viewport kept mounted. Two is enough to hide the
// mount cost at any plausible flick speed while keeping the bitmap working
// set small.
const OVERSCAN = 2;
// How long the zoom has to be still before pages re-rasterize. Short enough to
// feel immediate, long enough that a trackpad pinch rasterizes once, not forty
// times.
const RENDER_SETTLE_MS = 120;
// How long after the last scroll event the stage counts as still. Building a
// text layer means creating one absolutely-positioned span per glyph run —
// thousands of DOM nodes per page — so it waits for this.
const SCROLL_IDLE_MS = 150;

type ZoomMode = "fit-width" | "fit-page" | "custom";
export type PdfZoom = { mode: ZoomMode; value: number };

export type PdfViewerController = {
  layout: PdfLayout;
  metrics: PdfMetrics;
  scale: number;
  renderScale: number;
  rotation: number;
  zoom: PdfZoom;
  currentPage: number;
  pageWindow: { start: number; end: number };
  // The pages actually on screen, without the overscan padding. Text layers
  // key off this so settling a scroll doesn't build five of them at once.
  visibleWindow: { start: number; end: number };
  // True while the stage is being scrolled; pages use it to keep expensive,
  // non-visual work off the scroll path.
  scrolling: boolean;
  totalHeight: number;
  columnWidth: number;
  setZoom: (zoom: PdfZoom) => void;
  rotate: (turn: 1 | -1) => void;
  goToPage: (page: number, options?: { smooth?: boolean }) => void;
};

// The zoom ladder the +/- buttons walk. Wide steps at the bottom, tight ones
// around 100% where readers actually live.
const ZOOM_STOPS = [
  0.25, 0.33, 0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6,
];

export const nextZoomStop = (scale: number, direction: 1 | -1): number => {
  if (direction === 1) {
    return ZOOM_STOPS.find((stop) => stop > scale + 0.001) ?? MAX_SCALE;
  }
  return (
    [...ZOOM_STOPS].reverse().find((stop) => stop < scale - 0.001) ?? MIN_SCALE
  );
};

const clampScale = (scale: number): number =>
  Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

// Left edge of the page column at a given scale. Centered while the column
// fits, pinned to the padding once it overflows — the same rule the render
// path uses, so zoom anchoring stays exact instead of drifting sideways.
const columnLeft = (
  containerWidth: number,
  maxPageWidth: number,
  scale: number,
) => Math.max(STAGE_PADDING, (containerWidth - maxPageWidth * scale) / 2);

// Scroll events, coalesced to one frame. Attached manually rather than via
// onScroll so the listener can be passive — a non-passive scroll listener
// alone is enough to cost frames on a trackpad fling.
const useRafScroll = (
  container: HTMLDivElement | null,
  onScrollFrame: () => void,
  onScrollingChange: (scrolling: boolean) => void,
) => {
  const handlerRef = React.useRef(onScrollFrame);
  handlerRef.current = onScrollFrame;
  const scrollingRef = React.useRef(onScrollingChange);
  scrollingRef.current = onScrollingChange;

  React.useEffect(() => {
    if (!container) return;
    let frame: number | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      scrollingRef.current(true);
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => scrollingRef.current(false), SCROLL_IDLE_MS);
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        handlerRef.current();
      });
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (idleTimer !== null) clearTimeout(idleTimer);
      container.removeEventListener("scroll", onScroll);
    };
  }, [container]);
};

// Stage size drives the fit modes. Live (rAF-coalesced) rather than debounced:
// display scale is cheap now, so pages track a panel drag continuously and
// only re-rasterize once it settles.
const useStageViewport = (
  container: HTMLDivElement | null,
  setViewport: React.Dispatch<
    React.SetStateAction<{ width: number; height: number }>
  >,
) => {
  React.useEffect(() => {
    if (!container) return;
    let frame: number | null = null;
    let latest: { width: number; height: number } | null = null;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      latest = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!latest) return;
        const next = latest;
        setViewport((previous) =>
          previous.width === next.width && previous.height === next.height
            ? previous
            : next,
        );
      });
    });
    observer.observe(container);
    const initial = container.getBoundingClientRect();
    setViewport({ width: initial.width, height: initial.height });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [container, setViewport]);
};

export const usePdfViewer = (
  // The scroll element itself, not a ref: the engine renders a spinner until
  // the document resolves, so a ref would still be null when these effects
  // first ran and nothing would ever re-attach. Passing the element as state
  // makes every listener bind the moment the container actually mounts.
  container: HTMLDivElement | null,
  sizes: PdfPageSize[],
): PdfViewerController => {
  const [zoom, setZoomState] = React.useState<PdfZoom>({
    mode: "fit-width",
    value: 1,
  });
  const [rotation, setRotation] = React.useState(0);
  const [viewport, setViewport] = React.useState({ width: 0, height: 0 });
  const [pageWindow, setPageWindow] = React.useState({ start: 0, end: 0 });
  const [visibleWindow, setVisibleWindow] = React.useState({
    start: 0,
    end: 0,
  });
  const [currentPage, setCurrentPage] = React.useState(1);
  const [renderScale, setRenderScale] = React.useState(1);
  const [scrolling, setScrolling] = React.useState(false);

  const layout = React.useMemo(
    () => buildPdfLayout(sizes, rotation),
    [sizes, rotation],
  );

  // Fit modes measure against the widest page and the page under the reader,
  // so a landscape plate mid-document doesn't silently rescale the whole run.
  const scale = React.useMemo(() => {
    if (zoom.mode === "custom") return clampScale(zoom.value);
    if (viewport.width === 0 || layout.count === 0) return 1;
    const availableWidth = viewport.width - STAGE_PADDING * 2;
    const width = fitScale(layout.maxWidth, availableWidth, {
      min: MIN_SCALE,
      max: MAX_SCALE,
    });
    if (zoom.mode === "fit-width") return width;
    const active = layout.sizes[currentPage - 1] ?? layout.sizes[0];
    const height = fitScale(
      active?.height ?? 1,
      viewport.height - STAGE_PADDING * 2,
      { min: MIN_SCALE, max: MAX_SCALE },
    );
    return Math.min(width, height);
  }, [zoom, viewport, layout, currentPage]);

  const metrics = React.useMemo<PdfMetrics>(
    () => ({ scale, gap: PAGE_GAP, padding: STAGE_PADDING }),
    [scale],
  );

  const totalHeight = React.useMemo(
    () => contentHeight(layout, metrics),
    [layout, metrics],
  );
  const columnWidth = Math.max(
    viewport.width,
    layout.maxWidth * scale + STAGE_PADDING * 2,
  );

  // Reads live geometry, so callbacks stay identity-stable while the numbers
  // they need keep changing.
  const geometryRef = React.useRef({ layout, metrics, viewport });
  geometryRef.current = { layout, metrics, viewport };

  // Recompute the mounted page window and the page readout from the live
  // scroll position. Called on scroll (rAF-coalesced), resize, and zoom — and
  // deliberately a no-op when nothing changed, which is the common case.
  const syncWindow = React.useCallback(() => {
    const { layout: live, metrics: liveMetrics } = geometryRef.current;
    if (!container || live.count === 0) return;
    const top = container.scrollTop;
    const height = container.clientHeight;
    const range = visibleRange(live, top, height, liveMetrics, OVERSCAN);
    setPageWindow((previous) =>
      previous.start === range.start && previous.end === range.end
        ? previous
        : range,
    );
    const onScreen = visibleRange(live, top, height, liveMetrics, 0);
    setVisibleWindow((previous) =>
      previous.start === onScreen.start && previous.end === onScreen.end
        ? previous
        : onScreen,
    );
    // The page you'd say you're "on" is the one covering the upper third of
    // the stage, not the one that happens to touch the top edge.
    const page = pageIndexAt(live, top + height / 3, liveMetrics) + 1;
    setCurrentPage((previous) => (previous === page ? previous : page));
  }, [container]);

  useRafScroll(container, syncWindow, setScrolling);
  useStageViewport(container, setViewport);

  // Layout moved (zoom, rotate, resize, a page-size batch landing) — the
  // window has to be recomputed even though no scroll event fired.
  React.useEffect(() => {
    syncWindow();
  }, [syncWindow, layout, metrics, viewport]);

  // Settle the render scale after the gesture stops. Everything in between is
  // the compositor stretching the last good bitmap.
  React.useEffect(() => {
    const timer = setTimeout(() => setRenderScale(scale), RENDER_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [scale]);

  // Scroll corrections computed against the *old* layout have to land after
  // the new layout is in the DOM, or the browser clamps them to a scroll
  // extent that hasn't grown yet.
  const pendingScrollRef = React.useRef<{ top: number; left: number } | null>(
    null,
  );
  React.useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending || !container) return;
    pendingScrollRef.current = null;
    // scrollTo rather than two assignments: one layout write, and it keeps
    // the compiler's immutability check happy.
    container.scrollTo({ top: pending.top, left: pending.left });
  });

  // Change scale while keeping the document point under `anchor` (viewport
  // coordinates, defaulting to the stage center) pinned in place. Without
  // this, every zoom step teleports the reader somewhere else in the document.
  const applyScale = React.useCallback(
    (
      nextScale: number,
      anchor?: { clientX: number; clientY: number } | null,
    ) => {
      const { layout: live, metrics: liveMetrics } = geometryRef.current;
      const target = clampScale(nextScale);
      if (!container || live.count === 0) {
        setZoomState({ mode: "custom", value: target });
        return;
      }
      const rect = container.getBoundingClientRect();
      const offsetY = anchor
        ? anchor.clientY - rect.top
        : container.clientHeight / 2;
      const offsetX = anchor
        ? anchor.clientX - rect.left
        : container.clientWidth / 2;

      const anchorY = container.scrollTop + offsetY;
      const index = pageIndexAt(live, anchorY, liveMetrics);
      const currentTop = pageTop(live, index, liveMetrics);
      const currentHeight = pageSize(live, index, liveMetrics.scale).height;
      const fraction =
        currentHeight > 0 ? (anchorY - currentTop) / currentHeight : 0;

      const nextMetrics: PdfMetrics = { ...liveMetrics, scale: target };
      const nextTop =
        pageTop(live, index, nextMetrics) +
        fraction * pageSize(live, index, target).height;

      const currentLeft = columnLeft(
        container.clientWidth,
        live.maxWidth,
        liveMetrics.scale,
      );
      const baseX =
        (container.scrollLeft + offsetX - currentLeft) / liveMetrics.scale;
      const nextColumnWidth = Math.max(
        container.clientWidth,
        live.maxWidth * target + STAGE_PADDING * 2,
      );
      const nextLeft =
        baseX * target +
        columnLeft(container.clientWidth, live.maxWidth, target) -
        offsetX;

      pendingScrollRef.current = {
        top: Math.max(0, nextTop - offsetY),
        left: Math.max(
          0,
          Math.min(nextLeft, nextColumnWidth - container.clientWidth),
        ),
      };
      setZoomState({ mode: "custom", value: target });
    },
    [container],
  );

  const applyScaleRef = React.useRef(applyScale);
  applyScaleRef.current = applyScale;
  const scaleRef = React.useRef(scale);
  scaleRef.current = scale;

  // NOTE: there is deliberately no wheel listener on the scroll container.
  //
  // Trackpad pinch arrives as ctrl+wheel, and intercepting it needs
  // `preventDefault`, which means a *non-passive* wheel listener. Chromium
  // takes any non-passive wheel listener on a scroller (or its ancestors) as
  // notice that script might cancel the scroll, so it drops that scroller off
  // the compositor's fast path and runs every scroll through the main thread.
  // The whole point of the design above is that scrolling never touches the
  // main thread; one listener would have quietly undone it, and it would only
  // show up on a real trackpad — never in a synthetic scroll test.
  //
  // Zoom is available from the toolbar, the zoom menu, and +/-/0, all of which
  // route through `applyScale` and keep the anchoring. Pinch-to-zoom can come
  // back if native zoom is disabled at the Electron level first, so this
  // listener never has to cancel anything.

  const goToPage = React.useCallback(
    (page: number, options?: { smooth?: boolean }) => {
      const { layout: live, metrics: liveMetrics } = geometryRef.current;
      if (!container || live.count === 0) return;
      const index = Math.max(0, Math.min(live.count - 1, page - 1));
      const top = pageTop(live, index, liveMetrics) - STAGE_PADDING;
      // Smooth only for short hops: easing across two hundred pages would
      // mount and rasterize every page on the way.
      const nearby = Math.abs(index - (currentPage - 1)) <= 3;
      container.scrollTo({
        top: Math.max(0, top),
        behavior: options?.smooth !== false && nearby ? "smooth" : "auto",
      });
    },
    [container, currentPage],
  );

  const setZoom = React.useCallback((next: PdfZoom) => {
    if (next.mode === "custom") applyScaleRef.current(next.value, null);
    else setZoomState(next);
  }, []);

  const rotate = React.useCallback((turn: 1 | -1) => {
    setRotation((previous) => (previous + turn * 90 + 360) % 360);
  }, []);

  return {
    layout,
    metrics,
    scale,
    renderScale,
    rotation,
    zoom,
    currentPage,
    pageWindow,
    visibleWindow,
    scrolling,
    totalHeight,
    columnWidth,
    setZoom,
    rotate,
    goToPage,
  };
};
