// Draws a page into its own on-screen canvas, via the shared render queue.
//
// There is no intermediate bitmap and no cache: pdf.js paints directly into
// the element the reader is looking at, which is how its own viewer works. The
// canvas keeps its previous pixels while the request waits in the queue — the
// renderer only resizes it once its turn comes up (resizing is what clears a
// canvas), so the blank window is the render itself and nothing more.
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

// Trails `value`, settling only once it has been still for `delay` ms. Used to
// hold rendering back while a zoom or a resize is still moving.
export const useSettled = <T>(value: T, delay: number): T => {
  const [settled, setSettled] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
};
