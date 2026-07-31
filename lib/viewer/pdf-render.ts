// Render scheduling for the PDF engine.
//
// This module used to be a bitmap *cache*: pdf.js drew into a detached canvas,
// the result was kept in an LRU, and each page blitted from it into a second,
// on-screen canvas. That bought a "pages never go blank" property and cost far
// more than it was worth — two canvases per visible page, a multi-megapixel
// copy on every mount and every zoom settle, and a pool of retained backing
// stores large enough to put the compositor under memory pressure, at which
// point it discards canvases, which forces re-renders, which is where the
// freezing came from.
//
// So: no cache. What survives is a queue — pdf.js parses in the worker but
// *draws on the main thread*, so overlapping renders interleave long tasks and
// drop frames — plus one scratch canvas per renderer (not a cache: it holds no
// finished bitmaps, it's the drawing surface). pdf.js draws into the scratch,
// and the finished raster is blitted to the on-screen canvas in a single
// frame. The visible canvas therefore never clears mid-render and never shows
// a half-drawn page: resizing a canvas is what blanks it, and the old pixels
// (CSS-stretched to the new committed size) stay up until the swap.
import type { PDFDocumentProxy } from "pdfjs-dist";

// pdfjs-dist doesn't re-export TextContent from its entry point; derive it.
export type PdfTextContent = Awaited<
  ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["getTextContent"]>
>;

// Rasterizing at the full DPR of a 3x display costs 9x the pixels of a 1x one
// for a difference nobody can see on a page of body text. Two is the ceiling.
const MAX_RENDER_DPR = 2;

// Hard ceiling on one canvas (pdf.js caps the same way, via
// `maxCanvasPixels`). A fit-width page in a wide panel is easily 1400x1800 CSS
// px, which at DPR 2 is 10 megapixels — 40MB. Past this the effective device
// ratio is walked down instead; 8MP is still ~2900px on a side.
const MAX_BITMAP_PIXELS = 8_388_608;

export type PdfRenderHandle = {
  promise: Promise<void>;
  cancel: () => void;
};

export type PdfRenderer = {
  // Draws the page and, once the draw is complete, sizes `canvas`'s backing
  // store and blits the result in — the caller's canvas keeps its previous
  // pixels until then. The renderer never touches the canvas's CSS size;
  // callers stretch it over their page box (100%/100%), which is also what
  // keeps the old raster tracking the box while the new one is in flight.
  render(
    canvas: HTMLCanvasElement,
    page: number,
    scale: number,
    rotation: number,
  ): PdfRenderHandle;
  destroy(): void;
};

export const createPdfRenderer = (
  doc: PDFDocumentProxy,
  { concurrency }: { concurrency: number },
): PdfRenderer => {
  const liveTasks = new Set<{ cancel: () => void }>();
  const waiting: Array<() => void> = [];
  let active = 0;
  let destroyed = false;

  // Scratch drawing surfaces, pooled so concurrent slots never share one.
  // With concurrency 1 (both current renderers) this is a single canvas that
  // grows to the largest raster and is reused for every draw.
  const scratchPool: HTMLCanvasElement[] = [];

  const acquire = () =>
    new Promise<void>((resolve) => {
      if (active < concurrency) {
        active += 1;
        resolve();
        return;
      }
      waiting.push(() => {
        active += 1;
        resolve();
      });
    });

  // LIFO, not FIFO. During a fling the queue fills with pages the reader has
  // already scrolled past; the most recent request is the one they're actually
  // looking at, so it goes next and the stale backlog drains behind it.
  const releaseSlot = () => {
    active -= 1;
    waiting.pop()?.();
  };

  return {
    render: (canvas, pageNumber, scale, rotation) => {
      let cancelled = false;
      let task: { cancel: () => void } | null = null;

      const promise = (async () => {
        await acquire();
        try {
          if (cancelled || destroyed) return;
          const proxy = await doc.getPage(pageNumber);
          if (cancelled || destroyed) return;
          const viewport = proxy.getViewport({
            scale,
            rotation: (proxy.rotate + rotation) % 360,
          });

          // Walk the device ratio down rather than exceed the per-canvas cap.
          const area = Math.max(1, viewport.width * viewport.height);
          const dpr = Math.min(
            window.devicePixelRatio || 1,
            MAX_RENDER_DPR,
            Math.sqrt(MAX_BITMAP_PIXELS / area),
          );
          const width = Math.max(1, Math.floor(viewport.width * dpr));
          const height = Math.max(1, Math.floor(viewport.height * dpr));

          // Draw into the scratch, not the visible canvas — resizing is what
          // clears a canvas, and this resize happens off-screen.
          const scratch = scratchPool.pop() ?? document.createElement("canvas");
          try {
            scratch.width = width;
            scratch.height = height;
            const context = scratch.getContext("2d", { alpha: false });
            if (!context) return;
            // Opaque white ground: PDFs paint no background, and compositing
            // page content over transparent black fringes antialiased glyphs.
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, width, height);

            const render = proxy.render({
              canvas: scratch,
              canvasContext: context,
              viewport,
              transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
            });
            task = render;
            liveTasks.add(render);
            try {
              await render.promise;
            } finally {
              liveTasks.delete(render);
            }
            if (cancelled || destroyed) return;

            // The swap: size the visible backing store and copy in the same
            // task, so the reader goes from old raster to new with no cleared
            // or half-drawn frame in between.
            canvas.width = width;
            canvas.height = height;
            canvas.getContext("2d", { alpha: false })?.drawImage(scratch, 0, 0);
          } finally {
            // A render that outlived destroy() must not re-pool its scratch —
            // the pool was already drained; free the backing store instead.
            if (destroyed) {
              scratch.width = 0;
              scratch.height = 0;
            } else {
              scratchPool.push(scratch);
            }
          }
        } finally {
          releaseSlot();
        }
      })();

      return {
        promise,
        cancel: () => {
          cancelled = true;
          task?.cancel();
        },
      };
    },

    destroy: () => {
      destroyed = true;
      for (const task of liveTasks) task.cancel();
      liveTasks.clear();
      // Wake queued acquirers rather than abandoning them — each observes
      // `destroyed` and bails, so their render promises settle instead of
      // hanging forever.
      while (waiting.length > 0) waiting.pop()?.();
      // Free the scratch backing stores now rather than waiting for GC.
      for (const scratch of scratchPool) {
        scratch.width = 0;
        scratch.height = 0;
      }
      scratchPool.length = 0;
    },
  };
};

// pdf.js's TextLayer measures every span against a shared hidden canvas that
// it appends to document.body. Setting a font on an *attached* canvas forces a
// synchronous style recalc of whatever is dirty in the document — and the text
// layer dirties the document between measurements, so every span cost a
// full-document recalc (~14ms each in this app: seconds of freeze per dense
// page). Detached, the same measurement is ~3µs. pdf.js keeps its 2D-context
// reference and keeps working; the canvas just stops pinning the live DOM.
// Runs after every build because pdf.js re-creates the canvas after a cleanup.
export const detachPdfMeasureCanvases = () => {
  for (const canvas of document.querySelectorAll<HTMLCanvasElement>(
    "body > canvas",
  )) {
    // Match pdf.js's canvas by its full inline signature (see TextLayer
    // #getCtx: "position:absolute;…;display:none;letter-spacing:normal;…") so
    // another library's hidden probe canvas can't be swept up by accident.
    if (
      canvas.style.display === "none" &&
      canvas.style.width === "0px" &&
      canvas.style.letterSpacing === "normal"
    ) {
      canvas.remove();
    }
  }
};

// Text content is fetched by the text layer, by search, and by
// ViewerSession.getVisibleText — cache it per document so those three never
// pay for the same page twice. Keyed weakly so it dies with the document.
// (This one stays: it's small structured data, not megabytes of pixels.)
const textContentCaches = new WeakMap<
  PDFDocumentProxy,
  Map<number, Promise<PdfTextContent>>
>();

export const getPageTextContent = (
  doc: PDFDocumentProxy,
  pageNumber: number,
): Promise<PdfTextContent> => {
  let cache = textContentCaches.get(doc);
  if (!cache) {
    cache = new Map();
    textContentCaches.set(doc, cache);
  }
  const existing = cache.get(pageNumber);
  if (existing) return existing;
  const promise = doc
    .getPage(pageNumber)
    .then((page) => page.getTextContent())
    .catch((error: unknown) => {
      cache?.delete(pageNumber);
      throw error;
    });
  cache.set(pageNumber, promise);
  return promise;
};

// The item strings of a page, flattened the way a reader would see them.
export const flattenTextContent = (content: PdfTextContent): string =>
  content.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
