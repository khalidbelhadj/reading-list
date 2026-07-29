// pdf.js document loading for the PDF engine: worker bootstrap, the
// ownership-checked proxy fetch, per-page base metrics, the outline, and load
// errors.
//
// Page sizes are measured for *every* page, not just page 1 — mixed-size
// documents (a landscape figure plate, a scanned insert) otherwise get a
// scroll column that drifts further out of true with each odd page. They load
// in batches so a long document lays out progressively instead of blocking the
// first paint on a thousand `getPage` round trips.
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import React from "react";

import type { PdfPageSize } from "@/lib/viewer/pdf-layout";

if (typeof window !== "undefined" && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

const SIZE_BATCH = 24;

export type PdfOutlineNode = {
  id: string;
  title: string;
  bold: boolean;
  italic: boolean;
  dest: string | unknown[] | null;
  url: string | null;
  items: PdfOutlineNode[];
};

export type PdfDocumentState = {
  doc: PDFDocumentProxy | null;
  // One entry per page, seeded from page 1 and refined as batches land, so
  // `sizes.length === doc.numPages` from the first render.
  sizes: PdfPageSize[];
  outline: PdfOutlineNode[];
  error: string | null;
};

const toOutlineNodes = (
  raw: Awaited<ReturnType<PDFDocumentProxy["getOutline"]>> | null,
  prefix: string,
): PdfOutlineNode[] =>
  (raw ?? []).map((node, index) => ({
    id: `${prefix}${index}`,
    title: node.title,
    bold: node.bold,
    italic: node.italic,
    dest: (node.dest ?? null) as string | unknown[] | null,
    url: node.url,
    items: toOutlineNodes(node.items, `${prefix}${index}.`),
  }));

export const usePdfDocument = (itemId: string): PdfDocumentState => {
  const [doc, setDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = React.useState<PdfPageSize[]>([]);
  const [outline, setOutline] = React.useState<PdfOutlineNode[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Load the document through the ownership-checked proxy.
  React.useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setSizes([]);
    setOutline([]);
    setError(null);

    const task = getDocument({
      url: `/api/proxy-pdf?item=${encodeURIComponent(itemId)}`,
    });

    const measure = async (loaded: PDFDocumentProxy, seed: PdfPageSize) => {
      // A local array mutated in place, published as a fresh array per batch:
      // one render per batch instead of one per page.
      const measured: PdfPageSize[] = new Array<PdfPageSize>(
        loaded.numPages,
      ).fill(seed);
      for (let start = 2; start <= loaded.numPages; start += SIZE_BATCH) {
        const end = Math.min(start + SIZE_BATCH - 1, loaded.numPages);
        const batch = await Promise.all(
          Array.from({ length: end - start + 1 }, (_, offset) =>
            loaded.getPage(start + offset).then((page) => {
              const viewport = page.getViewport({ scale: 1 });
              return { width: viewport.width, height: viewport.height };
            }),
          ),
        );
        if (cancelled) return;
        batch.forEach((size, offset) => {
          measured[start - 1 + offset] = size;
        });
        setSizes([...measured]);
      }
    };

    void task.promise
      .then(async (loaded) => {
        // On unmount the cleanup's task.destroy() tears the document down.
        if (cancelled) return;
        const first = await loaded.getPage(1);
        if (cancelled) return;
        const viewport = first.getViewport({ scale: 1 });
        const seed = { width: viewport.width, height: viewport.height };
        setSizes(new Array<PdfPageSize>(loaded.numPages).fill(seed));
        setDoc(loaded);
        // Neither the outline nor the remaining page sizes gate first paint.
        void loaded
          .getOutline()
          .then((raw) => {
            if (!cancelled) setOutline(toOutlineNodes(raw, ""));
          })
          .catch(() => {});
        void measure(loaded, seed).catch(() => {});
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

  return { doc, sizes, outline, error };
};

// Outline entries point at a named or explicit destination; both resolve to a
// page index. Returns a 1-based page number, or null when the destination is
// unresolvable (broken bookmarks are common in the wild).
export const resolveOutlinePage = async (
  doc: PDFDocumentProxy,
  dest: string | unknown[] | null,
): Promise<number | null> => {
  try {
    const explicit =
      typeof dest === "string" ? await doc.getDestination(dest) : dest;
    const ref = Array.isArray(explicit) ? explicit[0] : null;
    if (!ref || typeof ref !== "object") return null;
    const index = await doc.getPageIndex(
      ref as Parameters<PDFDocumentProxy["getPageIndex"]>[0],
    );
    return index + 1;
  } catch {
    return null;
  }
};
