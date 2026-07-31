// Draws a page into its own on-screen canvas, via the shared render queue.
//
// The canvas keeps its previous pixels for the *entire* life of a request:
// pdf.js draws into the renderer's off-screen scratch, and the finished
// raster is blitted here in one frame (see lib/viewer/pdf-render.ts). A page
// therefore never blanks or shows a half-drawn state on zoom or re-render —
// the only white canvas is one that has never been drawn at all.
import React from "react";

import { type PdfRenderer } from "@/lib/viewer/pdf-render";

export const usePageCanvas = ({
  renderer,
  pageNumber,
  renderScale,
  rotation,
}: {
  renderer: PdfRenderer;
  pageNumber: number;
  // The *settled* scale to draw at — not the live display scale, which the
  // page bridges with a transform.
  renderScale: number;
  rotation: number;
}): React.RefObject<HTMLCanvasElement | null> => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = renderer.render(canvas, pageNumber, renderScale, rotation);
    // Cancellation is routine (scroll, zoom, unmount) and not an error.
    void handle.promise.catch(() => {});
    return () => handle.cancel();
  }, [renderer, pageNumber, renderScale, rotation]);

  // Release the backing store on unmount rather than waiting for GC — with
  // pages this size, "eventually" is late enough to matter. The element is
  // captured at mount so this doesn't race React detaching the ref.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    return () => {
      if (!canvas) return;
      canvas.width = 0;
      canvas.height = 0;
    };
  }, []);

  return canvasRef;
};
