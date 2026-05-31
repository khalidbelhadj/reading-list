import "server-only";

import { createRequire } from "node:module";

import { createCanvas } from "@napi-rs/canvas";

// arxiv abstract URL → derive the PDF URL.
// https://arxiv.org/abs/2103.00020  →  https://arxiv.org/pdf/2103.00020
// https://arxiv.org/abs/2103.00020v2 → https://arxiv.org/pdf/2103.00020v2
export const getPdfUrlForItem = (rawUrl: string): string | null => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "arxiv.org") {
      const absMatch = url.pathname.match(/^\/abs\/(.+?)\/?$/);
      if (absMatch) return `https://arxiv.org/pdf/${absMatch[1]}`;
      if (url.pathname.startsWith("/pdf/")) return url.toString();
    }
    // Direct .pdf links.
    if (url.pathname.toLowerCase().endsWith(".pdf")) return url.toString();
    return null;
  } catch {
    return null;
  }
};

const PREVIEW_WIDTH = 360;
const JPEG_QUALITY = 0.78;
// Cap downloaded PDF bytes so a malicious/oversized link can't OOM the
// server. 25MB covers ~95% of arxiv papers; bigger ones get skipped.
const MAX_PDF_BYTES = 25 * 1024 * 1024;

// Stream a Response body into memory but bail (returning null) the moment
// total bytes received cross the cap. Avoids buffering the whole body
// upfront via res.arrayBuffer() — that has no early exit.
const readCapped = async (
  res: Response,
  cap: number,
): Promise<Uint8Array | null> => {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > cap) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
};

// Lazy import pdfjs — it's heavy and only needed when actually rendering.
const loadPdfjs = async () => {
  // The legacy build is Node-friendly. v6 ships ESM at legacy/build/pdf.mjs.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdfjs requires a worker even on Node; point it at the bundled worker
  // file via require.resolve so the path works regardless of cwd.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const req = createRequire(import.meta.url);
    pdfjs.GlobalWorkerOptions.workerSrc = req.resolve(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
    );
  }
  return pdfjs;
};

// Render the first page of a PDF to a JPEG data URL.
export const renderPdfFirstPage = async (
  pdfUrl: string,
): Promise<string | null> => {
  try {
    const res = await fetch(pdfUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ReadingListPreviewBot/1.0",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    // Fast path: trust an honest Content-Length and reject upfront.
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared && declared > MAX_PDF_BYTES) {
      await res.body?.cancel();
      console.warn("[pdf-preview] PDF too large (content-length)", {
        pdfUrl,
        declared,
        cap: MAX_PDF_BYTES,
      });
      return null;
    }

    // Slow path: stream and abort if the body exceeds the cap.
    const buffer = await readCapped(res, MAX_PDF_BYTES);
    if (!buffer) {
      console.warn("[pdf-preview] PDF exceeded byte cap mid-stream", {
        pdfUrl,
        cap: MAX_PDF_BYTES,
      });
      return null;
    }

    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({
      data: buffer,
      disableFontFace: true,
    }).promise;

    try {
      const page = await doc.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = PREVIEW_WIDTH / baseViewport.width;
      const viewport = page.getViewport({ scale });

      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      const ctx = canvas.getContext("2d");
      // White paper background.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // pdfjs expects a 2D canvas context shaped like the browser's; the
      // napi-rs one is API-compatible enough for the operations pdfjs uses.
      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise;

      const jpeg = await canvas.encode("jpeg", Math.round(JPEG_QUALITY * 100));
      return `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}`;
    } finally {
      await doc.cleanup();
    }
  } catch (err) {
    console.warn("[pdf-preview] render failed", { pdfUrl, err });
    return null;
  }
};
