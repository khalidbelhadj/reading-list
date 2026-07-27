// pdf.js document loading for the PDF engine: worker bootstrap, the
// ownership-checked proxy fetch, base metrics of page 1, and load errors.
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import React from "react";

if (typeof window !== "undefined" && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

// Base (scale-1) metrics of page 1 — pages are assumed uniform, which holds
// for papers/books; oddballs just get an approximate scrollbar.
export type PageMetrics = { width: number; height: number };

export const usePdfDocument = (
  itemId: string,
): {
  doc: PDFDocumentProxy | null;
  baseMetrics: PageMetrics | null;
  error: string | null;
} => {
  const [doc, setDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [baseMetrics, setBaseMetrics] = React.useState<PageMetrics | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  // Load the document through the ownership-checked proxy.
  React.useEffect(() => {
    let cancelled = false;
    const task = getDocument({
      url: `/api/proxy-pdf?item=${encodeURIComponent(itemId)}`,
    });
    void task.promise
      .then(async (loaded) => {
        // On unmount the cleanup's task.destroy() tears the document down.
        if (cancelled) return;
        const page = await loaded.getPage(1);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        setBaseMetrics({ width: viewport.width, height: viewport.height });
        setDoc(loaded);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the PDF",
          );
        }
      });
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [itemId]);

  return { doc, baseMetrics, error };
};
