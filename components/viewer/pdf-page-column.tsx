// The scrolling page column: absolute-positioned pages over a spacer sized to
// the whole document. Only the pages in the controller's window are mounted;
// the rest cost a number in a prefix sum.
import type { PDFDocumentProxy } from "pdfjs-dist";
import type React from "react";

import {
  pageTop,
  type PdfLayout,
  type PdfMetrics,
} from "@/lib/viewer/pdf-layout";
import { type PdfRenderer } from "@/lib/viewer/pdf-render";

import { PdfPage } from "./pdf-page";
import { type PdfSearchMatch } from "./use-pdf-search";

export const PdfPageColumn = ({
  doc,
  renderer,
  layout,
  metrics,
  scale,
  renderScale,
  rotation,
  pageWindow,
  visibleWindow,
  totalHeight,
  columnWidth,
  searchQuery,
  activeResult,
  scrolling,
  onText,
}: {
  doc: PDFDocumentProxy;
  renderer: PdfRenderer;
  layout: PdfLayout;
  metrics: PdfMetrics;
  scale: number;
  renderScale: number;
  rotation: number;
  pageWindow: { start: number; end: number };
  visibleWindow: { start: number; end: number };
  totalHeight: number;
  columnWidth: number;
  searchQuery: string;
  activeResult: PdfSearchMatch | null;
  scrolling: boolean;
  onText: (pageNumber: number, text: string) => void;
}) => {
  const pages: React.ReactNode[] = [];
  for (let index = pageWindow.start; index <= pageWindow.end; index += 1) {
    const size = layout.sizes[index];
    if (!size) continue;
    const pageNumber = index + 1;
    pages.push(
      // Full-width row with the page centered inside it. Centering is left to
      // flexbox rather than computed from `columnWidth`, so it stays correct
      // on the frames before the stage has been measured (and on any page
      // narrower than the widest one in a mixed-size document).
      <div
        key={index}
        className="absolute inset-x-0 flex justify-center"
        style={{ top: pageTop(layout, index, metrics) }}
      >
        <PdfPage
          doc={doc}
          renderer={renderer}
          pageNumber={pageNumber}
          rotation={rotation}
          scale={scale}
          renderScale={renderScale}
          baseWidth={size.width}
          baseHeight={size.height}
          searchQuery={searchQuery}
          deferText={
            scrolling ||
            index < visibleWindow.start ||
            index > visibleWindow.end
          }
          activeOrdinal={
            activeResult?.page === pageNumber ? activeResult.ordinal : null
          }
          onText={onText}
        />
      </div>,
    );
  }

  return (
    <div
      className="relative"
      style={{ height: totalHeight, width: columnWidth, minWidth: "100%" }}
    >
      {pages}
    </div>
  );
};
