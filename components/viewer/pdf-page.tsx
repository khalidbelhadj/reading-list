// Single PDF page: canvas + text layer, rendered when the engine's
// virtualizer brings it into view.
import { type PDFDocumentProxy, TextLayer } from "pdfjs-dist";
import React from "react";

export const PdfPage = ({
  doc,
  pageNumber,
  scale,
  width,
  height,
  onText,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  width: number;
  height: number;
  onText: (pageNumber: number, text: string) => void;
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const textRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null =
      null;

    void (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        const canvasContext = canvas?.getContext("2d");
        if (!canvas || !canvasContext) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);

        renderTask = page.render({
          canvas,
          canvasContext,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        await renderTask.promise;
        if (cancelled) return;

        // Text layer: absolutely-positioned transparent spans over the
        // canvas — selection, find, and ViewerSession.getSelection all work.
        const textContent = await page.getTextContent();
        if (cancelled || !textRef.current) return;
        const plain = textContent.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        onText(pageNumber, plain);

        textRef.current.replaceChildren();
        textRef.current.style.setProperty("--scale-factor", String(scale));
        const textLayer = new TextLayer({
          textContentSource: textContent,
          container: textRef.current,
          viewport,
        });
        await textLayer.render();
      } catch (error) {
        // Cancellation is routine (scroll/zoom); anything else logs.
        if (!cancelled && !String(error).includes("Rendering cancelled")) {
          console.warn("[pdf] page render failed", { pageNumber, error });
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageNumber, scale, onText]);

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-md bg-white shadow-md"
      style={{ width, height }}
    >
      <canvas ref={canvasRef} style={{ width, height }} />
      <div ref={textRef} className="pdf-text-layer" />
    </div>
  );
};
