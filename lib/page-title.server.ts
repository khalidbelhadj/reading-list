// Page-title resolution engine behind the fetchPageTitle action: YouTube
// oEmbed, PDF title extraction, then a capped HTML fetch parsed for
// og:title / <title>.
import { extractPdfTitleOnly } from "@/lib/pdf-preview.server";
import { getPdfUrl } from "@/lib/pdf-url";
import { readCapped, safeFetch } from "@/lib/url.server";

const fromCodePoint = (code: number): string =>
  Number.isFinite(code) && code >= 0 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : "";

const decodeHtmlEntities = (value: string): string =>
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

// Collapse runs of whitespace to single spaces and trim. Titles arrive with
// source line wrapping that carries no meaning.
const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const MAX_TITLE_HTML_BYTES = 512 * 1024;

const fetchOembedTitle = async (url: string): Promise<string | null> => {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    // Fixed host, but every outbound fetch in this codebase goes through the
    // SSRF guard so the rule has no exceptions to remember.
    const res = await safeFetch(oembedUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
    };
    const title = typeof data.title === "string" ? data.title : null;
    if (!title) return null;
    const channel =
      typeof data.author_name === "string" ? data.author_name.trim() : "";
    return channel ? `${title} - ${channel}` : title;
  } catch {
    return null;
  }
};

export const fetchPageTitleForUrl = async (
  url: string,
): Promise<string | null> => {
  try {
    const parsed = new URL(url);
    const isYouTube = /^(www\.)?(youtube\.com|youtu\.be)$/.test(
      parsed.hostname,
    );
    if (isYouTube) {
      const title = await fetchOembedTitle(url);
      if (title) return title;
    }

    // PDF short-circuit: if the URL clearly points at a PDF (suffix or
    // arxiv abs/pdf), extract title straight from the document. This
    // beats HTML parsing because arxiv's <title> includes the paper id
    // prefix, and direct PDFs have no HTML at all.
    const pdfUrl = getPdfUrl(url);
    if (pdfUrl) {
      const pdfTitle = await extractPdfTitleOnly(pdfUrl);
      if (pdfTitle) return pdfTitle;
      // Fall through to HTML parse on miss — some arxiv abs pages have
      // useful <title> tags even when the PDF extraction fails.
    }

    const res = await safeFetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    // Titles live near the top of the document — read at most 512KB.
    const merged = await readCapped(res, MAX_TITLE_HTML_BYTES, {
      truncate: true,
    });
    if (!merged) return null;
    const text = new TextDecoder("utf-8", { fatal: false }).decode(merged);
    const ogMatch =
      text.match(
        /<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i,
      ) ||
      text.match(
        /<meta[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:title["'][^>]*>/i,
      );
    const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const match = ogMatch || titleMatch;
    if (!match || match[1] === undefined) return null;
    return collapseWhitespace(decodeHtmlEntities(match[1]));
  } catch {
    return null;
  }
};
