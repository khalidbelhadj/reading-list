// The extractor ladder, in the worker: turn a url into structured markdown,
// best effort. One strategy per kind of link — YouTube, arXiv, PDFs, and
// the readable article everything else is assumed to be — each degrading
// gracefully. Bytes come through the server's fetch proxy (browsers can't
// read other origins); parsing happens here, off the main thread.
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import TurndownService from "turndown";

import { getArxivId, getPdfUrl } from "@/lib/pdf-url";

import { FetchError, fetchUrl } from "./api";

export type Extracted = {
  extractor: "youtube" | "arxiv" | "pdf" | "html";
  title: string | null;
  markdown: string;
};

// A link this ladder cannot turn into content (paywall, app shell, 404, a
// private address). Terminal: the server marks the item unsupported.
export class UnsupportedContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedContentError";
  }
}

const MAX_PDF_PAGES = 80;
// Below this the "article" is a cookie wall or an app shell, not content.
const MIN_CONTENT_CHARS = 200;

// Postgres text rejects NUL, and PDF text layers are full of stray control
// characters; keep tabs and newlines, drop the rest.
const CONTROL_CHARS = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]",
  "g",
);
const sanitize = (text: string) => text.replace(CONTROL_CHARS, "");

const decode = (bytes: Uint8Array) =>
  new TextDecoder("utf-8", { fatal: false }).decode(bytes);

const decodeJsonString = (raw: string): string => {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
};

const fetchText = async (url: string) => decode((await fetchUrl(url)).bytes);

// --- YouTube: oEmbed for the title and channel, the watch page for the
// description. Transcripts are blocked upstream without a session token.
const isYouTube = (url: URL) =>
  /^(www\.|m\.)?(youtube\.com|youtu\.be)$/.test(url.hostname);

const extractYouTube = async (url: string): Promise<Extracted> => {
  let title: string | null = null;
  let channel: string | null = null;
  try {
    const data = JSON.parse(
      await fetchText(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      ),
    ) as { title?: string; author_name?: string };
    title = typeof data.title === "string" ? data.title : null;
    channel = typeof data.author_name === "string" ? data.author_name : null;
  } catch {}
  let description = "";
  try {
    const html = await fetchText(url);
    const match = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
    if (match?.[1]) description = decodeJsonString(match[1]).trim();
  } catch {}
  if (!title && !description) {
    throw new UnsupportedContentError("No video metadata");
  }
  const lines = [
    title ? `# ${title}` : null,
    channel ? `YouTube video by ${channel}.` : "YouTube video.",
    description || null,
  ].filter(Boolean);
  return { extractor: "youtube", title, markdown: lines.join("\n\n") };
};

// --- PDF: page text via pdfjs, joined with paragraph breaks where the text
// layer says a line ends. pdfjs runs its own nested worker.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type TextItem = { str?: string; hasEOL?: boolean };

const pdfText = async (bytes: Uint8Array): Promise<string> => {
  const doc = await pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
  }).promise;
  try {
    const pages: string[] = [];
    const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items as TextItem[]) {
        if (!item.str) continue;
        text += item.str;
        text += item.hasEOL ? "\n" : "";
      }
      // Hyphenated line breaks are typesetting, not content.
      text = text.replace(/-\n(?=[a-z])/g, "").replace(/[ \t]+\n/g, "\n");
      pages.push(text.trim());
    }
    return pages.filter((page) => page.length > 0).join("\n\n");
  } finally {
    await doc.cleanup();
  }
};

const extractPdf = async (bytes: Uint8Array): Promise<Extracted> => {
  const text = await pdfText(bytes);
  if (text.length < MIN_CONTENT_CHARS) {
    throw new UnsupportedContentError("PDF has no text layer");
  }
  return { extractor: "pdf", title: null, markdown: text };
};

// --- arXiv: the API gives a clean title and abstract; the PDF text follows
// when it can be had.
const decodeXml = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const extractArxiv = async (url: string, id: string): Promise<Extracted> => {
  let title: string | null = null;
  let abstract: string | null = null;
  try {
    const xml = await fetchText(
      `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`,
    );
    const entry = xml.split("<entry>")[1] ?? "";
    title = decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    abstract = decodeXml(
      entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "",
    );
  } catch {}
  let body = "";
  try {
    body = await pdfText((await fetchUrl(getPdfUrl(url) ?? url)).bytes);
  } catch {}
  if (!abstract && body.length < MIN_CONTENT_CHARS) {
    throw new UnsupportedContentError("No arXiv metadata or PDF text");
  }
  const parts = [
    title ? `# ${title}` : null,
    abstract ? `## Abstract\n\n${abstract}` : null,
    body || null,
  ].filter(Boolean);
  return {
    extractor: "arxiv",
    title: title || null,
    markdown: parts.join("\n\n"),
  };
};

// --- Readable article: Readability picks the content out of the page,
// turndown keeps its structure (headings, lists, code, links) as markdown.
// Workers have no DOMParser, so linkedom provides the DOM for both.
const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
turndown.remove(["script", "style", "noscript", "iframe"]);
turndown.addRule("drop-svg", {
  filter: (node) => node.nodeName === "SVG",
  replacement: () => "",
});

const extractHtml = (html: string, url: string): Extracted => {
  const { document } = parseHTML(html);
  const base = document.createElement("base");
  base.setAttribute("href", url);
  document.head?.appendChild(base);
  const article = new Readability(document as unknown as Document, {
    charThreshold: MIN_CONTENT_CHARS,
  }).parse();
  let markdown = "";
  if (article?.content) {
    const { document: fragment } = parseHTML(
      `<html><body>${article.content}</body></html>`,
    );
    try {
      markdown = turndown
        .turndown(fragment.body as unknown as HTMLElement)
        .trim();
    } catch {
      markdown = (article.textContent ?? "").trim();
    }
  } else {
    markdown = (document.body?.textContent ?? "")
      .replace(/\s+\n/g, "\n")
      .trim();
  }
  if (markdown.replace(/\s+/g, " ").length < MIN_CONTENT_CHARS) {
    throw new UnsupportedContentError("No readable content");
  }
  return {
    extractor: "html",
    title: article?.title?.trim() || null,
    markdown,
  };
};

const isPdfBytes = (bytes: Uint8Array) =>
  bytes[0] === 0x25 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x44 &&
  bytes[3] === 0x46;

const extractRaw = async (rawUrl: string): Promise<Extracted> => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsupportedContentError("Invalid url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsupportedContentError("Not an http(s) url");
  }
  if (isYouTube(url)) return extractYouTube(rawUrl);
  const arxivId = getArxivId(rawUrl);
  if (arxivId) return extractArxiv(rawUrl, arxivId);
  const target = getPdfUrl(rawUrl) ?? rawUrl;
  const { bytes, contentType, finalUrl } = await fetchUrl(target);
  if (contentType.includes("application/pdf") || isPdfBytes(bytes)) {
    return extractPdf(bytes);
  }
  return extractHtml(decode(bytes), finalUrl);
};

export const extractContent = async (rawUrl: string): Promise<Extracted> => {
  try {
    const extracted = await extractRaw(rawUrl);
    return {
      ...extracted,
      title: extracted.title ? sanitize(extracted.title) : null,
      markdown: sanitize(extracted.markdown),
    };
  } catch (error) {
    if (error instanceof FetchError && error.permanent) {
      throw new UnsupportedContentError(error.message);
    }
    throw error;
  }
};
