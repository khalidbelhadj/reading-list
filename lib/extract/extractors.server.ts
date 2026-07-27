// The extraction ladder: given an item URL, produce structured markdown.
// Port of the strategy ladder prototyped in analysis/fetch_content.py.
// Every network fetch goes through safeFetch (lib/url.server.ts) so the
// SSRF guard applies — this module fetches arbitrary user-saved URLs.
import { loadPdfDocument } from "@/lib/pdf-preview.server";
import { getYouTubeVideoId } from "@/lib/url";
import { readCapped, safeFetch } from "@/lib/url.server";

import { classifyUrl, getArxivId, getPdfUrl } from "./classify";
import { htmlToArticleMarkdown } from "./readability.server";

// Provenance only: stamped onto item_content rows at write time so we know
// which extractor produced them. Bumping it does NOT trigger automatic
// re-extraction — the worker's claim query only picks up pending rows;
// re-extraction is manual via the reextractItem action.
export const EXTRACTOR_VERSION = 1;

export type Extractor = "web" | "pdf" | "arxiv" | "youtube";

export type Extraction = {
  extractor: Extractor;
  title: string | null;
  markdown: string;
};

// Terminal "this URL will never extract" (binary blobs, empty readability
// output) — the worker maps it to status "unsupported" instead of retrying.
export class UnsupportedContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedContentError";
  }
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 20_000;
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MAX_PDF_PAGES = 80;
// Below this many words, readability output is a cookie banner or a paywall
// stub, not an article.
const MIN_ARTICLE_WORDS = 40;

export const countWords = (text: string): number =>
  text.split(/\s+/).filter(Boolean).length;

// ---------------------------------------------------------------------------
// Web pages (and the shared HTML → markdown step used by live capture)
// ---------------------------------------------------------------------------

export const extractFromHtml = (html: string, url: string): Extraction => {
  const article = htmlToArticleMarkdown(html, url);
  if (!article || countWords(article.markdown) < MIN_ARTICLE_WORDS) {
    throw new UnsupportedContentError(
      "No readable article content on this page",
    );
  }
  return { extractor: "web", title: article.title, markdown: article.markdown };
};

const extractWeb = async (url: string): Promise<Extraction> => {
  const res = await safeFetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/pdf" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/pdf")) {
    const bytes = await readCapped(res, MAX_PDF_BYTES);
    if (!bytes) throw new Error("PDF exceeds size cap");
    return extractPdfBytes(bytes);
  }
  if (!contentType.includes("html")) {
    throw new UnsupportedContentError(
      `Unsupported content type: ${contentType || "unknown"}`,
    );
  }

  const bytes = await readCapped(res, MAX_HTML_BYTES);
  if (!bytes) throw new Error("HTML exceeds size cap");
  const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return extractFromHtml(html, url);
};

// ---------------------------------------------------------------------------
// PDFs
// ---------------------------------------------------------------------------

const extractPdfBytes = async (bytes: Uint8Array): Promise<Extraction> => {
  const doc = await loadPdfDocument(bytes);
  try {
    let title: string | null = null;
    try {
      const meta = await doc.getMetadata();
      const raw = (meta?.info as { Title?: string } | undefined)?.Title;
      if (raw && raw.trim().length >= 4) title = raw.trim();
    } catch {
      // Metadata is optional.
    }

    const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
    const pages: string[] = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        text += item.hasEOL ? "\n" : " ";
      }
      const cleaned = text.replace(/[ \t]+/g, " ").trim();
      if (cleaned) pages.push(cleaned);
    }

    const markdown = pages.join("\n\n");
    if (countWords(markdown) < MIN_ARTICLE_WORDS) {
      throw new UnsupportedContentError(
        "PDF has no extractable text (likely scanned)",
      );
    }
    return { extractor: "pdf", title, markdown };
  } finally {
    await doc.cleanup();
  }
};

const extractPdf = async (pdfUrl: string): Promise<Extraction> => {
  const res = await safeFetch(pdfUrl, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`PDF fetch failed with status ${res.status}`);
  const bytes = await readCapped(res, MAX_PDF_BYTES);
  if (!bytes) throw new Error("PDF exceeds size cap");
  return extractPdfBytes(bytes);
};

// ---------------------------------------------------------------------------
// arXiv: abstract + metadata from the API, full text from the PDF
// ---------------------------------------------------------------------------

// Numeric entities are code points, not UTF-16 units — fromCharCode would
// mangle anything above U+FFFF (emoji, CJK extensions) into a lone surrogate.
const fromCodePoint = (code: number): string =>
  Number.isInteger(code) && code >= 0 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : "";

// Shared HTML/XML entity decoder (also used by lib/page-title.server.ts).
// `&amp;` is decoded last so double-encoded entities aren't over-decoded.
// Decoding only — see collapseWhitespace for the separate normalization step.
export const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&amp;/g, "&");

// Collapse runs of whitespace to single spaces and trim. Titles and abstracts
// arrive with source line wrapping that carries no meaning; kept separate
// from decodeHtmlEntities so callers opt in rather than inherit it.
export const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const decodeAndCollapse = (value: string): string =>
  collapseWhitespace(decodeHtmlEntities(value));

const extractArxiv = async (arxivId: string): Promise<Extraction> => {
  const res = await safeFetch(
    `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`,
    { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) throw new Error(`arXiv API failed with status ${res.status}`);
  const xml = await res.text();

  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1];
  if (!entry) throw new Error("arXiv API returned no entry");
  const title = decodeAndCollapse(
    entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "",
  );
  const summary = decodeAndCollapse(
    entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "",
  );
  const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)]
    .map((match) => decodeAndCollapse(match[1] ?? ""))
    .filter(Boolean);
  const published =
    entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.slice(0, 10) ?? "";

  const parts = [
    `# ${title || `arXiv:${arxivId}`}`,
    "",
    `**Authors:** ${authors.join(", ") || "unknown"}`,
    `**Published:** ${published || "unknown"} · arXiv:${arxivId}`,
    "",
    "## Abstract",
    "",
    summary,
  ];

  // Full text is best-effort — the abstract alone is a valid extraction tier.
  try {
    const pdf = await extractPdf(`https://arxiv.org/pdf/${arxivId}`);
    parts.push("", "## Full text", "", pdf.markdown);
  } catch {
    // Keep abstract-only.
  }

  return {
    extractor: "arxiv",
    title: title || null,
    markdown: parts.join("\n"),
  };
};

// ---------------------------------------------------------------------------
// YouTube: oEmbed metadata + description + transcript (best-effort)
// ---------------------------------------------------------------------------

// mm:ss, or h:mm:ss past the hour — these are meant to be pasted back as a
// YouTube timestamp, and "75:30" isn't one.
const formatTimestamp = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mmss = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
};

// Group transcript segments into ~45s paragraphs, each prefixed with its
// start timestamp — keeps the text scannable and gives future video captures
// an anchor to quote.
const TRANSCRIPT_PARAGRAPH_MS = 45_000;

type TranscriptSegment = { startMs: number; text: string };

// Fallback path: the raw timedtext caption track. YouTube frequently serves
// this empty without a po_token (a browser-attestation token we don't mint),
// so this works for some videos/regions only — transcripts are best-effort
// by design; title + description still index.
const fetchCaptionTrack = async (
  info: InnertubeVideoInfo,
): Promise<TranscriptSegment[]> => {
  const base = info.captions?.caption_tracks?.[0]?.base_url;
  if (!base) return [];
  // base_url comes from the YouTube API response (attacker-influenceable via
  // the saved URL), so it goes through the SSRF guard like every other fetch.
  const res = await safeFetch(`${base}&fmt=json3`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const text = await res.text();
  if (!text) return [];
  const data = JSON.parse(text) as {
    events?: Array<{ tStartMs?: number; segs?: Array<{ utf8?: string }> }>;
  };
  return (data.events ?? [])
    .map((event) => ({
      startMs: event.tStartMs ?? 0,
      text: (event.segs ?? [])
        .map((seg) => seg.utf8 ?? "")
        .join("")
        .replace(/\s+/g, " ")
        .trim(),
    }))
    .filter((segment) => segment.text);
};

const loadInnertube = async () => {
  const { Innertube } = await import("youtubei.js");
  return Innertube.create({ retrieve_player: false });
};

type InnertubeVideoInfo = Awaited<
  ReturnType<Awaited<ReturnType<typeof loadInnertube>>["getInfo"]>
>;

const fetchYouTubeTranscript = async (
  info: InnertubeVideoInfo,
): Promise<string> => {
  let segments: TranscriptSegment[] = [];
  try {
    const transcriptInfo = await info.getTranscript();
    segments = (
      transcriptInfo?.transcript?.content?.body?.initial_segments ?? []
    )
      .map((segment) => ({
        startMs: Number(segment.start_ms ?? 0),
        text: segment?.snippet?.text?.trim() ?? "",
      }))
      .filter((segment) => segment.text);
  } catch {
    // get_transcript endpoint is flaky; fall through to the caption track.
  }
  if (segments.length === 0) {
    segments = await fetchCaptionTrack(info);
  }

  const paragraphs: string[] = [];
  let currentStart = -1;
  let currentText = "";
  for (const segment of segments) {
    if (currentStart === -1) currentStart = segment.startMs;
    if (
      segment.startMs - currentStart > TRANSCRIPT_PARAGRAPH_MS &&
      currentText
    ) {
      paragraphs.push(`**[${formatTimestamp(currentStart)}]** ${currentText}`);
      currentStart = segment.startMs;
      currentText = segment.text;
    } else {
      currentText = currentText
        ? `${currentText} ${segment.text}`
        : segment.text;
    }
  }
  if (currentText && currentStart !== -1) {
    paragraphs.push(`**[${formatTimestamp(currentStart)}]** ${currentText}`);
  }
  return paragraphs.join("\n\n");
};

const extractYouTube = async (
  url: string,
  videoId: string,
): Promise<Extraction> => {
  // oEmbed is the reliable half: title + channel.
  let title: string | null = null;
  let channel = "";
  try {
    // Fixed host (www.youtube.com) — only the query string is user-derived —
    // but routed through safeFetch anyway to keep the file's invariant simple.
    const res = await safeFetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = (await res.json()) as {
        title?: string;
        author_name?: string;
      };
      title = typeof data.title === "string" ? data.title : null;
      channel = typeof data.author_name === "string" ? data.author_name : "";
    }
  } catch {
    // Metadata fallback below.
  }

  // Description + transcript via Innertube — the flaky half, each best-effort.
  let description = "";
  let transcript = "";
  try {
    const yt = await loadInnertube();
    const info = await yt.getInfo(videoId);
    description = info.basic_info?.short_description?.trim() ?? "";
    if (!title && info.basic_info?.title) title = info.basic_info.title;
    if (!channel && info.basic_info?.author) channel = info.basic_info.author;
    try {
      transcript = await fetchYouTubeTranscript(info);
    } catch {
      // No transcript (disabled, live stream, or upstream API change).
    }
  } catch {
    // Description is optional.
  }

  const parts = [`# ${title ?? `YouTube video ${videoId}`}`];
  if (channel) parts.push("", `**Channel:** ${channel}`);
  if (description) parts.push("", "## Description", "", description);
  if (transcript) parts.push("", "## Transcript", "", transcript);

  const markdown = parts.join("\n");
  if (!description && !transcript && !title) {
    throw new Error("Could not fetch any YouTube metadata");
  }
  return { extractor: "youtube", title, markdown };
};

// ---------------------------------------------------------------------------
// Ladder entry point
// ---------------------------------------------------------------------------

export const extractForUrl = async (url: string): Promise<Extraction> => {
  const kind = classifyUrl(url);
  switch (kind) {
    case "youtube": {
      const videoId = getYouTubeVideoId(url);
      if (!videoId) return extractWeb(url);
      return extractYouTube(url, videoId);
    }
    case "arxiv": {
      const arxivId = getArxivId(url);
      if (!arxivId) return extractWeb(url);
      return extractArxiv(arxivId);
    }
    case "pdf": {
      const pdfUrl = getPdfUrl(url);
      if (!pdfUrl) return extractWeb(url);
      return extractPdf(pdfUrl);
    }
    case "web":
      return extractWeb(url);
  }
};
