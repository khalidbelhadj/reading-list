// Custom PDF engine: pdf.js rendering pages as cards on the app background,
// virtualized with @tanstack/react-virtual, with a text layer so selection
// works. Replaces the browser's built-in viewer — this both matches the app's
// design language and makes PDFs fully observable through ViewerSession
// (page, visible text, selection), which the built-in viewer's opaque plugin
// never allowed. Zoom/page controls render as a floating pill over the pages;
// the session's `pdf` capability exposes the same controls programmatically.
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import React from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useDebouncedElementWidth } from "@/lib/use-debounced-resize";
import { describeSelection } from "@/lib/viewer/selection";
import {
  createViewerEmitter,
  useRegisterViewerSession,
  type ViewerSession,
  type ViewerState,
} from "@/lib/viewer/session";

import { PdfPage } from "./pdf-page";
import { usePdfDocument } from "./use-pdf-document";

const PAGE_GAP = 16;
const STAGE_PADDING = 24;
const MAX_FIT_WIDTH = 900;

type Scale = number | "fit";

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
  const { doc, baseMetrics, error } = usePdfDocument(itemId);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scaleSetting, setScaleSetting] = React.useState<Scale>("fit");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageTextsRef = React.useRef(new Map<number, string>());
  const emitterRef = React.useRef(createViewerEmitter());

  // Track the stage width for fit-to-width. The first measurement applies
  // immediately (the initial rasterization needs the real width); during a
  // continuous resize (window or panel drag) every tick would otherwise
  // change `scale` and re-rasterize every visible canvas at DPR — very
  // expensive — so subsequent measurements are debounced trailing: pages keep
  // their last-settled size mid-resize and re-render once (canvas + text
  // layer together, so they stay aligned) after the resize settles.
  const containerWidth = useDebouncedElementWidth(containerRef);

  const scale = React.useMemo(() => {
    if (scaleSetting !== "fit") return scaleSetting;
    if (!baseMetrics || containerWidth === 0) return 1;
    const available = Math.min(
      containerWidth - STAGE_PADDING * 2,
      MAX_FIT_WIDTH,
    );
    return Math.max(0.3, available / baseMetrics.width);
  }, [scaleSetting, baseMetrics, containerWidth]);

  const pageCount = doc?.numPages ?? 0;
  const pageWidth = (baseMetrics?.width ?? 600) * scale;
  const pageHeight = (baseMetrics?.height ?? 800) * scale;

  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => pageHeight + PAGE_GAP,
    overscan: 1,
  });
  const virtualizerRef = React.useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  // Re-measure when zoom changes.
  React.useEffect(() => {
    virtualizerRef.current.measure();
  }, [pageHeight]);

  // Current page = the page covering the upper third of the stage.
  const virtualItems = virtualizer.getVirtualItems();
  const scrollOffset = virtualizer.scrollOffset ?? 0;
  React.useEffect(() => {
    const anchor = scrollOffset + (containerRef.current?.clientHeight ?? 0) / 3;
    const active = virtualItems.find(
      (item) => item.start <= anchor && item.end > anchor,
    );
    const page = (active?.index ?? 0) + 1;
    setCurrentPage((previous) => (previous === page ? previous : page));
  }, [virtualItems, scrollOffset]);

  const stateRef = React.useRef({ page: 1, pageCount: 0, scale: scaleSetting });
  stateRef.current = { page: currentPage, pageCount, scale: scaleSetting };

  const handlePageText = React.useCallback(
    (pageNumber: number, text: string) => {
      pageTextsRef.current.set(pageNumber, text);
    },
    [],
  );

  const session = React.useMemo<ViewerSession>(() => {
    return {
      kind: "pdf",
      itemId,
      pdf: {
        state: () => ({ ...stateRef.current }),
        goToPage: (page: number) => {
          const target = Math.min(
            Math.max(1, page),
            stateRef.current.pageCount,
          );
          virtualizerRef.current.scrollToIndex(target - 1, { align: "start" });
        },
        setScale: (next: Scale) => setScaleSetting(next),
      },
      getState: async (): Promise<ViewerState> => ({
        kind: "pdf",
        url,
        title,
        page: {
          current: stateRef.current.page,
          total: stateRef.current.pageCount,
        },
        selection: containerRef.current
          ? describeSelection(containerRef.current)
          : null,
      }),
      // Text of the pages currently in view — real visible-context now that
      // the text layer is ours (the built-in viewer was a black box). Falls
      // back to extracted markdown before the text layer has rendered.
      getVisibleText: async () => {
        const texts = virtualizerRef.current
          .getVirtualItems()
          .map((item) => pageTextsRef.current.get(item.index + 1))
          .filter((text): text is string => Boolean(text));
        if (texts.length > 0) return texts.join("\n\n").slice(0, 8000);
        return markdown?.slice(0, 4000) ?? "";
      },
      getSelection: async () =>
        containerRef.current ? describeSelection(containerRef.current) : null,
      on: emitterRef.current.on,
    };
  }, [itemId, url, title, markdown]);

  useRegisterViewerSession(session);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm">Couldn’t display this PDF</p>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!doc || !baseMetrics) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const stepZoom = (direction: 1 | -1) => {
    const current = scaleSetting === "fit" ? scale : scaleSetting;
    setScaleSetting(
      Math.min(
        3,
        Math.max(0.3, Math.round((current + direction * 0.1) * 10) / 10),
      ),
    );
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ padding: STAGE_PADDING }}
      >
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((item) => (
            <div
              key={item.key}
              className="absolute left-0 w-full"
              style={{ top: item.start, height: item.size }}
            >
              <PdfPage
                doc={doc}
                pageNumber={item.index + 1}
                scale={scale}
                width={pageWidth}
                height={pageHeight}
                onText={handlePageText}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Page + zoom — engine-owned, floating over the pages (the panel
          toolbar stays minimal). */}
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-card/90 px-2 py-0.5 text-xs text-muted-foreground shadow-md backdrop-blur">
        <span className="px-1 font-mono tabular-nums">
          {currentPage} / {pageCount}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => stepZoom(-1)}
          aria-label="Zoom out"
        >
          <IconMinus />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1 font-mono text-xs tabular-nums"
          onClick={() => setScaleSetting("fit")}
          aria-label="Fit width"
        >
          {scaleSetting === "fit" ? "Fit" : `${Math.round(scale * 100)}%`}
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => stepZoom(1)}
          aria-label="Zoom in"
        >
          <IconPlus />
        </Button>
      </div>
    </div>
  );
};
