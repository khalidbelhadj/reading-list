// Thumbnail rail for the PDF sidebar.
//
// Virtualized with the same layout primitives as the main column — a
// thumbnail strip is just the document laid out at a tiny scale — so a
// thousand-page book costs the same as a ten-page memo. Thumbnails draw
// through their own render queue, so filling the rail can never sit in front
// of the page the reader is actually looking at.
//
// Thumbnails track the sidebar's width with the same two-scale trick as the
// main column: the CSS box follows the drag frame by frame while the redraw
// waits for it to settle.
import React from "react";

import { useSettled } from "@/lib/use-settled";
import { cn } from "@/lib/utils";
import {
  buildPdfLayout,
  contentHeight,
  pageTop,
  type PdfMetrics,
  type PdfPageSize,
  visibleRange,
} from "@/lib/viewer/pdf-layout";
import { type PdfRenderer } from "@/lib/viewer/pdf-render";

import { usePageCanvas } from "./use-page-canvas";

// Room the rail keeps either side of a thumbnail for the page-number label and
// the active outline.
const RAIL_INSET = 32;
const MIN_THUMB_WIDTH = 64;
const THUMB_GAP = 26;
const THUMB_PADDING = 10;
const OVERSCAN = 3;
const RENDER_SETTLE_MS = 140;

const PdfThumbnail = ({
  renderer,
  pageNumber,
  renderScale,
  width,
  height,
  active,
  onSelect,
}: {
  renderer: PdfRenderer;
  pageNumber: number;
  renderScale: number;
  width: number;
  height: number;
  active: boolean;
  onSelect: (page: number) => void;
}) => {
  const canvasRef = usePageCanvas({
    renderer,
    pageNumber,
    renderScale,
    rotation: 0,
  });

  return (
    <button
      type="button"
      onClick={() => onSelect(pageNumber)}
      className="group/thumb flex w-full flex-col items-center gap-1 outline-none"
      aria-label={`Page ${pageNumber}`}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={cn(
          "block overflow-hidden rounded-sm border bg-white transition-colors",
          active
            ? "border-primary ring-1 ring-primary"
            : "border-border group-hover/thumb:border-foreground/30",
        )}
        style={{ width, height }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </span>
      <span
        className={cn(
          "font-mono text-[0.625rem] tabular-nums",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {pageNumber}
      </span>
    </button>
  );
};

export const PdfThumbnails = ({
  renderer,
  sizes,
  currentPage,
  width,
  onSelect,
}: {
  renderer: PdfRenderer;
  sizes: PdfPageSize[];
  currentPage: number;
  // Width of the sidebar the rail lives in.
  width: number;
  onSelect: (page: number) => void;
}) => {
  const [scrollElement, setScrollElement] =
    React.useState<HTMLDivElement | null>(null);
  const [range, setRange] = React.useState({ start: 0, end: 8 });

  const layout = React.useMemo(() => buildPdfLayout(sizes, 0), [sizes]);
  const thumbWidth = Math.max(MIN_THUMB_WIDTH, width - RAIL_INSET);
  const scale = layout.maxWidth > 0 ? thumbWidth / layout.maxWidth : 0.2;
  // Rasterize at the settled width; the CSS size below follows the drag.
  const renderScale = useSettled(scale, RENDER_SETTLE_MS);
  const metrics = React.useMemo<PdfMetrics>(
    () => ({ scale, gap: THUMB_GAP, padding: THUMB_PADDING }),
    [scale],
  );

  const geometryRef = React.useRef({ layout, metrics });
  geometryRef.current = { layout, metrics };

  const sync = React.useCallback(() => {
    const { layout: live, metrics: liveMetrics } = geometryRef.current;
    if (!scrollElement || live.count === 0) return;
    const next = visibleRange(
      live,
      scrollElement.scrollTop,
      scrollElement.clientHeight,
      liveMetrics,
      OVERSCAN,
    );
    setRange((previous) =>
      previous.start === next.start && previous.end === next.end
        ? previous
        : next,
    );
  }, [scrollElement]);

  const syncRef = React.useRef(sync);
  syncRef.current = sync;

  React.useEffect(() => {
    if (!scrollElement) return;
    let frame: number | null = null;
    const onScroll = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        syncRef.current();
      });
    };
    scrollElement.addEventListener("scroll", onScroll, { passive: true });
    syncRef.current();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      scrollElement.removeEventListener("scroll", onScroll);
    };
  }, [scrollElement]);

  React.useEffect(() => {
    sync();
  }, [sync, layout, metrics]);

  // Follow the reader: keep the active page's thumbnail in view.
  React.useEffect(() => {
    const { layout: live, metrics: liveMetrics } = geometryRef.current;
    if (!scrollElement || live.count === 0) return;
    const top = pageTop(live, currentPage - 1, liveMetrics);
    const height =
      (live.sizes[currentPage - 1]?.height ?? 0) * liveMetrics.scale;
    const viewTop = scrollElement.scrollTop;
    const viewBottom = viewTop + scrollElement.clientHeight;
    if (top < viewTop || top + height > viewBottom) {
      scrollElement.scrollTo({
        top: Math.max(0, top - scrollElement.clientHeight / 3),
      });
    }
  }, [currentPage, scrollElement]);

  const rows: React.ReactNode[] = [];
  for (let index = range.start; index <= range.end; index += 1) {
    const size = layout.sizes[index];
    if (!size) continue;
    rows.push(
      <div
        key={index}
        className="absolute inset-x-0"
        style={{ top: pageTop(layout, index, metrics) }}
      >
        <PdfThumbnail
          renderer={renderer}
          pageNumber={index + 1}
          renderScale={renderScale}
          width={size.width * scale}
          height={size.height * scale}
          active={index + 1 === currentPage}
          onSelect={onSelect}
        />
      </div>,
    );
  }

  return (
    <div ref={setScrollElement} className="min-h-0 flex-1 overflow-y-auto">
      <div
        className="relative"
        style={{ height: contentHeight(layout, metrics) }}
      >
        {rows}
      </div>
    </div>
  );
};
