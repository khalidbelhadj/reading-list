// A single PDF page: canvas, selectable text layer, search highlights.
//
// The three layers are deliberately decoupled from zoom:
//
//  * The **canvas** is drawn into directly by pdf.js at the *settled* scale.
//    A zoom gesture doesn't touch it: the live scale is applied to a wrapper
//    as a compositor transform, so existing pixels stretch for free and the
//    page is redrawn once, when the gesture stops.
//  * The **text layer** is built once per page/rotation. pdf.js lays it out in
//    percentages against `--total-scale-factor`, so zoom is a CSS variable
//    change — no rebuild, no re-fetch, no lost selection. When the zoom
//    settles it is re-*measured* in place via `update()`, which keeps
//    selection aligned with the painted glyphs without touching the DOM.
//  * **Highlights** are stored as fractions of the page for the same reason.
import { type PDFDocumentProxy, TextLayer } from "pdfjs-dist";
import React from "react";

import { cn } from "@/lib/utils";
import {
  flattenTextContent,
  getPageTextContent,
  type PdfRenderer,
} from "@/lib/viewer/pdf-render";
import {
  computeHighlightRects,
  type HighlightRect,
} from "@/lib/viewer/pdf-search";

import { usePageCanvas } from "./use-page-canvas";

export const PdfPage = ({
  doc,
  renderer,
  pageNumber,
  rotation,
  scale,
  renderScale,
  baseWidth,
  baseHeight,
  searchQuery,
  activeOrdinal,
  deferText,
  onText,
}: {
  doc: PDFDocumentProxy;
  renderer: PdfRenderer;
  pageNumber: number;
  rotation: number;
  // Live display scale — changes every frame of a zoom.
  scale: number;
  // Settled scale the canvas is drawn at.
  renderScale: number;
  baseWidth: number;
  baseHeight: number;
  searchQuery: string;
  activeOrdinal: number | null;
  // True while the stage is scrolling — hold the text layer back until it
  // stops (see the effect below).
  deferText: boolean;
  onText: (pageNumber: number, text: string) => void;
}) => {
  const textRef = React.useRef<HTMLDivElement>(null);
  const textLayerRef = React.useRef<TextLayer | null>(null);
  const [textVersion, setTextVersion] = React.useState(0);
  const [layoutVersion, setLayoutVersion] = React.useState(0);
  const [highlights, setHighlights] = React.useState<HighlightRect[]>([]);

  const onTextRef = React.useRef(onText);
  onTextRef.current = onText;
  // Read inside the async build so a scale that settled mid-build is honoured
  // without adding renderScale to the build effect's deps (which would make
  // every zoom rebuild the layer instead of re-laying it out).
  const renderScaleRef = React.useRef(renderScale);
  renderScaleRef.current = renderScale;

  const canvasRef = usePageCanvas({
    renderer,
    pageNumber,
    renderScale,
    rotation,
  });

  // Text layer — scale-independent, so it's built once per page/rotation and
  // never touched by zoom.
  //
  // It is also the single most expensive thing a page does: pdf.js creates one
  // absolutely-positioned span per glyph run, which on a dense paper is a few
  // thousand DOM nodes. Building that while the reader is mid-fling is what
  // makes scrolling stutter, so it waits for the stage to be still. Nothing
  // visible depends on it — the canvas is already painted; only selection and
  // search highlights arrive a beat later.
  const builtKeyRef = React.useRef("");
  // Scale the spans were last laid out at — see the update effect below.
  const layoutScaleRef = React.useRef(0);
  React.useEffect(() => {
    const container = textRef.current;
    const key = `${pageNumber}:${rotation}`;
    // Identity changed (rotation) — drop what's there before rebuilding.
    if (builtKeyRef.current && builtKeyRef.current !== key) {
      builtKeyRef.current = "";
      container?.replaceChildren();
      textLayerRef.current = null;
    }
    if (!container || deferText || builtKeyRef.current === key) return;

    let cancelled = false;
    let layer: TextLayer | null = null;
    void (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const content = await getPageTextContent(doc, pageNumber);
        if (cancelled) return;
        onTextRef.current(pageNumber, flattenTextContent(content));
        // Built at the *render* scale, not at 1. Positions and font sizes are
        // scale-independent (percentages against --total-scale-factor), but
        // the per-span horizontal squeeze is not: pdf.js derives it from a
        // ctx.measureText at the build scale, and measuring 9px text
        // quantizes badly enough that the invisible spans drift off the
        // painted glyphs — which is exactly what makes a selection look like
        // it's boxing the wrong words.
        const viewport = page.getViewport({
          scale: renderScaleRef.current,
          rotation: (page.rotate + rotation) % 360,
        });
        container.replaceChildren();
        layer = new TextLayer({
          textContentSource: content,
          container,
          viewport,
        });
        await layer.render();
        if (cancelled) return;
        textLayerRef.current = layer;
        builtKeyRef.current = key;
        layoutScaleRef.current = renderScaleRef.current;
        setTextVersion((version) => version + 1);
      } catch {
        // A cancelled text layer is normal on fast scroll.
      }
    })();

    return () => {
      cancelled = true;
      layer?.cancel();
    };
  }, [doc, pageNumber, rotation, deferText]);

  // Re-measure the spans when the zoom settles. `update()` re-runs pdf.js's
  // per-span layout against the new scale *without* rebuilding any DOM, so
  // selection stays pixel-accurate at every zoom level for a fraction of the
  // cost of a rebuild. Between settles the layer is still geometrically right
  // (it's laid out in percentages) — only the squeeze is momentarily stale.
  React.useEffect(() => {
    const layer = textLayerRef.current;
    if (!layer || deferText || layoutScaleRef.current === renderScale) return;
    let cancelled = false;
    void doc
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled || textLayerRef.current !== layer) return;
        layer.update({
          viewport: page.getViewport({
            scale: renderScale,
            rotation: (page.rotate + rotation) % 360,
          }),
        });
        layoutScaleRef.current = renderScale;
        setLayoutVersion((version) => version + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, rotation, renderScale, deferText, textVersion]);

  // Highlights depend on the query and the rendered spans — not on zoom.
  React.useEffect(() => {
    const layer = textLayerRef.current;
    const container = textRef.current;
    if (!layer || !container || !searchQuery) {
      setHighlights([]);
      return;
    }
    setHighlights(
      computeHighlightRects({
        divs: layer.textDivs,
        strings: layer.textContentItemsStr,
        container,
        query: searchQuery,
        activeOrdinal,
      }),
    );
  }, [searchQuery, activeOrdinal, textVersion, layoutVersion]);

  // The page box tracks the live scale (it's one element — cheap). Everything
  // *inside* is laid out at the committed render scale and bridged to the live
  // one by a single transform.
  //
  // This is what makes a zoom gesture cheap. Driving `--scale-factor` live
  // looks equivalent, but it changes the font-size of every span in the text
  // layer, so each frame relayouts thousands of elements per page. A transform
  // is compositor-only: no layout, no repaint, no text-layer work at all.
  // Layout happens once, when the zoom settles and `renderScale` catches up.
  const width = baseWidth * scale;
  const height = baseHeight * scale;
  const committedWidth = baseWidth * renderScale;
  const committedHeight = baseHeight * renderScale;
  const bridge = renderScale > 0 ? scale / renderScale : 1;

  return (
    <div
      className="pdf-page relative overflow-hidden rounded-md bg-white"
      style={
        {
          width,
          height,
          // Committed, not live: the text layer derives its whole geometry
          // from this (see .pdf-page in app/globals.css), and we only want it
          // to re-lay-out once per settle.
          "--scale-factor": renderScale,
        } as React.CSSProperties
      }
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: committedWidth,
          height: committedHeight,
          transform: bridge === 1 ? undefined : `scale(${bridge})`,
        }}
      >
        {/* Sized by the renderer, not here — it owns both the backing store
            and the CSS box so the two can never disagree. */}
        <canvas ref={canvasRef} className="block" aria-hidden />
        <div className="pointer-events-none absolute inset-0">
          {highlights.map((rect, index) => (
            <div
              key={index}
              className={cn(
                "absolute rounded-[1px]",
                rect.active ? "bg-primary/45" : "bg-primary/20",
              )}
              style={{
                left: `${rect.left * 100}%`,
                top: `${rect.top * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
              }}
            />
          ))}
        </div>
        <div ref={textRef} className="pdf-text-layer" />
      </div>

      {/* Page edge. A painted overlay rather than a border or an outline on
          `.pdf-page` itself: a border would shrink the content box and nudge
          the canvas, and an outline is easy to lose to the paint containment
          on the page. This is a plain sibling — it always paints, on top. */}
      <div className="pdf-page-edge pointer-events-none absolute inset-0 rounded-md" />
    </div>
  );
};
