import "server-only";

import { createRequire } from "node:module";

import { createCanvas } from "@napi-rs/canvas";

// Cheap, sync URL-shape detection. Covers arxiv (abs needs rewriting to
// /pdf/) and anything ending in .pdf.
export const getPdfUrlForItemSync = (rawUrl: string): string | null =>
  tryUrlMatchPdf(rawUrl);

const tryUrlMatchPdf = (rawUrl: string): string | null => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "arxiv.org") {
      const absMatch = url.pathname.match(/^\/abs\/(.+?)\/?$/);
      if (absMatch) return `https://arxiv.org/pdf/${absMatch[1]}`;
      if (url.pathname.startsWith("/pdf/")) return url.toString();
    }
    if (url.pathname.toLowerCase().endsWith(".pdf")) return url.toString();
    return null;
  } catch {
    return null;
  }
};

// Network probe: fetch the first 4 bytes via a Range request and check the
// PDF magic number (`%PDF`, hex 25 50 44 46). Catches PDFs served behind
// redirects or query routes whose URL doesn't end in `.pdf`.
const looksLikePdfByMagic = async (rawUrl: string): Promise<boolean> => {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const res = await fetch(rawUrl, {
      headers: {
        Range: "bytes=0-3",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ReadingListPreviewBot/1.0",
      },
      signal: AbortSignal.timeout(5_000),
      redirect: "follow",
    });
    // 206 = honored the Range; 200 = served the full body anyway (still fine,
    // we'll only read the first chunk and bail).
    if (!res.ok && res.status !== 206) {
      await res.body?.cancel();
      return false;
    }
    const reader = res.body?.getReader();
    if (!reader) return false;
    const { value } = await reader.read();
    await reader.cancel();
    if (!value || value.byteLength < 4) return false;
    return (
      value[0] === 0x25 &&
      value[1] === 0x50 &&
      value[2] === 0x44 &&
      value[3] === 0x46
    );
  } catch {
    return false;
  }
};

// Resolve an item URL to a fetchable PDF URL, or null if the link isn't a
// PDF. Tries the cheap suffix/arxiv check first, then falls back to a
// magic-byte probe over the network.
export const getPdfUrlForItem = async (
  rawUrl: string,
): Promise<string | null> => {
  const direct = tryUrlMatchPdf(rawUrl);
  if (direct) return direct;
  if (await looksLikePdfByMagic(rawUrl)) return rawUrl;
  return null;
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

const loadPdfDocument = async (data: Uint8Array) => {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({ data, disableFontFace: true }).promise;
};

type PdfDoc = Awaited<ReturnType<typeof loadPdfDocument>>;
type PdfPage = Awaited<ReturnType<PdfDoc["getPage"]>>;

const fetchPdfBytes = async (pdfUrl: string): Promise<Uint8Array | null> => {
  const res = await fetch(pdfUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ReadingListPreviewBot/1.0",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
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
  const buffer = await readCapped(res, MAX_PDF_BYTES);
  if (!buffer) {
    console.warn("[pdf-preview] PDF exceeded byte cap mid-stream", {
      pdfUrl,
      cap: MAX_PDF_BYTES,
    });
    return null;
  }
  return buffer;
};

// Reject obvious junk titles that pdfjs sometimes pulls out of the
// metadata dictionary (LaTeX defaults, "untitled.pdf", etc.).
const sanitizeTitle = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (trimmed.length < 4 || trimmed.length > 300) return null;
  const junk = [
    /^untitled\b/i,
    /^microsoft word/i,
    /\.(docx?|tex|pdf)$/i,
    /^document\d*$/i,
    /^preprint$/i,
    /^paper\s*\d*$/i,
    /^arxiv:\d/i,
  ];
  if (junk.some((re) => re.test(trimmed))) return null;
  return trimmed;
};

// Heuristic: pick the largest-font line(s) in the top half of page 1,
// concatenate top-down. Works on academic papers because the title is
// typographically distinct from authors / affiliations / abstract.
type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};
type Line = { y: number; size: number; text: string };

const extractTitleFromText = async (
  page: PdfPage,
  pageHeight: number,
): Promise<string | null> => {
  try {
    const content = await page.getTextContent();
    const items = (content.items as TextItem[]).filter(
      (it) => it.str && it.str.trim().length > 0,
    );
    if (items.length === 0) return null;

    // Group consecutive items at similar (y, font size) into a single line.
    // PDF coordinates have origin bottom-left, so larger y == higher on page.
    items.sort(
      (a, b) =>
        (b.transform[5] ?? 0) - (a.transform[5] ?? 0) ||
        (a.transform[4] ?? 0) - (b.transform[4] ?? 0),
    );
    const lines: Line[] = [];
    for (const it of items) {
      const size = Math.abs(it.transform[3] ?? 0);
      const y = it.transform[5] ?? 0;
      const str = it.str;
      const last = lines[lines.length - 1];
      if (
        last &&
        Math.abs(last.y - y) < 2 &&
        Math.abs(last.size - size) < 0.5
      ) {
        // Continue current line. Add a space if pdfjs split mid-word
        // without one (typical for figure captions / ligatures).
        const needsSpace = !last.text.endsWith(" ") && !str.startsWith(" ");
        last.text += (needsSpace ? " " : "") + str;
      } else {
        lines.push({ y, size, text: str });
      }
    }

    // Only consider the top half of the page — anything below is body text.
    const cutoff = pageHeight * 0.5;
    const top = lines.filter((l) => l.y > cutoff && l.text.trim().length > 2);
    if (top.length === 0) return null;

    const maxSize = top.reduce((m, l) => Math.max(m, l.size), 0);
    // Take consecutive top-most lines that are within 0.5pt of the max
    // font size — captures multi-line titles.
    const titleLines = top
      .filter((l) => l.size >= maxSize - 0.5)
      .sort((a, b) => b.y - a.y);
    const combined = titleLines.map((l) => l.text).join(" ");
    return sanitizeTitle(combined);
  } catch {
    return null;
  }
};

const extractTitleFromMetadata = async (
  doc: PdfDoc,
): Promise<string | null> => {
  try {
    const meta = await doc.getMetadata();
    const raw = (meta?.info as { Title?: string } | undefined)?.Title;
    return sanitizeTitle(raw);
  } catch {
    return null;
  }
};

const extractTitle = async (
  doc: PdfDoc,
  page: PdfPage,
  pageHeight: number,
): Promise<string | null> => {
  // Metadata is ground truth when present and well-formed.
  const fromMeta = await extractTitleFromMetadata(doc);
  if (fromMeta) return fromMeta;
  return extractTitleFromText(page, pageHeight);
};

const renderPageToJpegDataUrl = async (page: PdfPage) => {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = PREVIEW_WIDTH / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
    canvas: canvas as unknown as HTMLCanvasElement,
  }).promise;

  const jpeg = await canvas.encode("jpeg", Math.round(JPEG_QUALITY * 100));
  return `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}`;
};

export type PdfExtractResult = {
  imageDataUrl: string;
  title: string | null;
};

// Full extraction: render page 1 to a JPEG AND extract the title.
export const renderPdfFirstPage = async (
  pdfUrl: string,
): Promise<PdfExtractResult | null> => {
  try {
    const buffer = await fetchPdfBytes(pdfUrl);
    if (!buffer) return null;
    const doc = await loadPdfDocument(buffer);
    try {
      const page = await doc.getPage(1);
      const pageHeight = page.getViewport({ scale: 1 }).height;
      const [imageDataUrl, title] = await Promise.all([
        renderPageToJpegDataUrl(page),
        extractTitle(doc, page, pageHeight),
      ]);
      return { imageDataUrl, title };
    } finally {
      await doc.cleanup();
    }
  } catch (err) {
    console.warn("[pdf-preview] render failed", { pdfUrl, err });
    return null;
  }
};

// Title-only extraction. Cheaper than renderPdfFirstPage when the caller
// doesn't need an image (e.g. fetchPageTitle autofill).
export const extractPdfTitleOnly = async (
  pdfUrl: string,
): Promise<string | null> => {
  try {
    const buffer = await fetchPdfBytes(pdfUrl);
    if (!buffer) return null;
    const doc = await loadPdfDocument(buffer);
    try {
      const page = await doc.getPage(1);
      const pageHeight = page.getViewport({ scale: 1 }).height;
      return await extractTitle(doc, page, pageHeight);
    } finally {
      await doc.cleanup();
    }
  } catch (err) {
    console.warn("[pdf-preview] title extract failed", { pdfUrl, err });
    return null;
  }
};
