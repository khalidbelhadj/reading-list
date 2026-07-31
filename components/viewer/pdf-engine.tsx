// Custom PDF engine: pdf.js rendering pages as cards on the app background,
// virtualized, with a real text layer so selection works. Replaces the
// browser's built-in viewer — this both matches the app's design language and
// makes PDFs fully observable through ViewerSession (page, visible text,
// selection), which the built-in viewer's opaque plugin never allowed.
//
// The moving parts live next door: `use-pdf-viewer` owns scale/scroll/page,
// `lib/viewer/pdf-render` owns the render queue, `pdf-sidebar` owns
// thumbnails/bookmarks/search, `use-pdf-session` owns the agent-facing
// session. This file is composition and keyboard handling.
import React from "react";

import { Spinner } from "@/components/ui/spinner";
import { EASE, SLIDE_MS } from "@/lib/motion";
import { usePanelResize } from "@/lib/use-panel-resize";
import { cn } from "@/lib/utils";
import { createPdfRenderer } from "@/lib/viewer/pdf-render";

import { PdfPageColumn } from "./pdf-page-column";
import { PdfSidebar, type PdfSidebarTab } from "./pdf-sidebar";
import { PdfToolbar } from "./pdf-toolbar";
import { usePdfDocument } from "./use-pdf-document";
import { usePdfSearch } from "./use-pdf-search";
import { usePdfSession } from "./use-pdf-session";
import { nextZoomStop, usePdfViewer } from "./use-pdf-viewer";

const SIDEBAR_DEFAULT = 280;
// Floor set by the tab strip, not by the thumbnails: below this the three tab
// labels stop fitting on one row and get clipped.
const SIDEBAR_MIN = 264;
const SIDEBAR_MAX = 460;

const safeFileName = (title: string) =>
  `${(title || "document").replace(/[^\w.-]+/g, "-").slice(0, 80)}.pdf`;

export const PdfEngine = ({
  itemId,
  url,
  title,
  markdown,
}: {
  itemId: string;
  url: string;
  title: string;
  markdown: string | null;
}) => {
  const { doc, sizes, outline, error } = usePdfDocument(itemId);
  // The scroll element as state, not a ref: this component renders a spinner
  // until the document resolves, so effects keyed on a ref would run while it
  // was still null and never re-attach.
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const pageTextsRef = React.useRef(new Map<number, string>());

  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarWidth, setSidebarWidth] = React.useState(SIDEBAR_DEFAULT);
  const [sidebarTab, setSidebarTab] =
    React.useState<PdfSidebarTab>("thumbnails");

  // Slide choreography: the rail mounts at width 0 and transitions open a
  // tick later (same enter pattern as use-slide-in); on close it transitions
  // shut first and unmounts after the slide, so thumbnails stop costing
  // anything once it's gone. The rail itself keeps its full width inside a
  // clipping wrapper — content is revealed, never squished.
  const [sidebarMounted, setSidebarMounted] = React.useState(false);
  const [sidebarEntered, setSidebarEntered] = React.useState(false);
  React.useEffect(() => {
    // setTimeout, not rAF — a throttled tab may never paint a frame.
    if (sidebarOpen) {
      setSidebarMounted(true);
      const timer = setTimeout(() => setSidebarEntered(true), 10);
      return () => clearTimeout(timer);
    }
    setSidebarEntered(false);
    const timer = setTimeout(() => setSidebarMounted(false), SLIDE_MS + 50);
    return () => clearTimeout(timer);
  }, [sidebarOpen]);

  const renderers = React.useMemo(
    () =>
      doc
        ? {
            // Serialized, and two queues rather than one: pdf.js draws on the
            // main thread, so overlapping renders only interleave long tasks,
            // and filling the thumbnail rail must never sit in front of the
            // page the reader is looking at.
            page: createPdfRenderer(doc, { concurrency: 1 }),
            thumb: createPdfRenderer(doc, { concurrency: 1 }),
          }
        : null,
    [doc],
  );
  React.useEffect(
    () => () => {
      renderers?.page.destroy();
      renderers?.thumb.destroy();
    },
    [renderers],
  );

  const {
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
  } = usePdfViewer(container, sizes);
  const search = usePdfSearch(doc);

  usePdfSession({
    itemId,
    url,
    title,
    markdown,
    container,
    pageTextsRef,
    currentPage,
    pageCount: layout.count,
    zoom,
    pageWindow,
    goToPage,
    setZoom,
  });

  const handlePageText = React.useCallback(
    (pageNumber: number, text: string) => {
      pageTextsRef.current.set(pageNumber, text);
    },
    [],
  );

  const handleZoomStep = React.useCallback(
    (direction: 1 | -1) => {
      setZoom({ mode: "custom", value: nextZoomStop(scale, direction) });
    },
    [scale, setZoom],
  );

  const handleFitWidth = React.useCallback(() => {
    setZoom({ mode: "fit-width", value: scale });
  }, [scale, setZoom]);

  const handleOpenSearch = React.useCallback(() => {
    setSidebarOpen(true);
    setSidebarTab("search");
  }, []);

  const handleRotate = React.useCallback(() => rotate(1), [rotate]);

  // Sidebar resize. The width is React state rather than a direct style write
  // (the pattern the reading panel uses) because the rail's thumbnails have to
  // resize with it — and that's affordable here precisely because the column
  // beside it now rescales on the compositor and rasterizes only on settle.
  const applySidebarWidth = React.useCallback((clientX: number) => {
    const left = rowRef.current?.getBoundingClientRect().left ?? 0;
    setSidebarWidth(
      Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, clientX - left)),
    );
  }, []);
  const { dragging, startResize } = usePanelResize({
    onDrag: applySidebarWidth,
    onEnd: applySidebarWidth,
  });

  // Jumping to a hit is a side effect of the active result changing, so it
  // fires the same way whether the reader clicked the list or stepped with the
  // keyboard. goToPage is identity-stable, so depending on it is free.
  const activeResult = search.results[search.activeIndex] ?? null;
  React.useEffect(() => {
    if (activeResult) goToPage(activeResult.page);
  }, [activeResult, goToPage]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if ((event.metaKey || event.ctrlKey) && event.key === "f") {
        event.preventDefault();
        handleOpenSearch();
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "+" || event.key === "=") handleZoomStep(1);
      else if (event.key === "-") handleZoomStep(-1);
      else if (event.key === "0") handleFitWidth();
      else if (event.key === "r") handleRotate();
      else return;
      event.preventDefault();
    },
    [handleFitWidth, handleOpenSearch, handleRotate, handleZoomStep],
  );

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm">Couldn’t display this PDF</p>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!doc || !renderers || layout.count === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onKeyDown={handleKeyDown}
    >
      <PdfToolbar
        currentPage={currentPage}
        pageCount={layout.count}
        scale={scale}
        zoom={zoom}
        sidebarOpen={sidebarOpen}
        downloadUrl={`/api/proxy-pdf?item=${encodeURIComponent(itemId)}`}
        downloadName={safeFileName(title)}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onGoToPage={goToPage}
        onZoomStep={handleZoomStep}
        onSetZoom={setZoom}
        onRotate={handleRotate}
      />

      <div ref={rowRef} className="flex min-h-0 flex-1">
        {sidebarMounted && (
          <div
            className="flex shrink-0 overflow-hidden"
            style={{
              width: sidebarEntered ? sidebarWidth : 0,
              transition: dragging ? undefined : `width ${SLIDE_MS}ms ${EASE}`,
            }}
          >
            <PdfSidebar
              doc={doc}
              renderer={renderers.thumb}
              sizes={sizes}
              outline={outline}
              currentPage={currentPage}
              tab={sidebarTab}
              onTabChange={setSidebarTab}
              onGoToPage={goToPage}
              search={search}
              onGoToResult={search.setActiveIndex}
              width={sidebarWidth}
            />
          </div>
        )}

        {/* Resize handle — a zero-width flex item whose grab area straddles
            the sidebar's border, so the divider itself is what you drag. */}
        {sidebarOpen && (
          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={startResize}
            className="relative z-10 w-0 shrink-0 cursor-col-resize"
          >
            <div className="absolute inset-y-0 -left-1 w-2" />
            <div
              className={cn(
                "pointer-events-none absolute inset-y-0 -left-px w-px transition-colors",
                dragging ? "bg-foreground/50" : "bg-transparent",
              )}
            />
          </div>
        )}

        <div
          ref={setContainer}
          tabIndex={0}
          className="min-h-0 min-w-0 flex-1 [scrollbar-width:thin] overflow-auto [overscroll-behavior:contain] outline-none"
        >
          <PdfPageColumn
            doc={doc}
            renderer={renderers.page}
            layout={layout}
            metrics={metrics}
            scale={scale}
            renderScale={renderScale}
            rotation={rotation}
            pageWindow={pageWindow}
            visibleWindow={visibleWindow}
            totalHeight={totalHeight}
            columnWidth={columnWidth}
            searchQuery={search.query.trim()}
            activeResult={activeResult}
            scrolling={scrolling}
            onText={handlePageText}
          />
        </div>
      </div>
    </div>
  );
};
