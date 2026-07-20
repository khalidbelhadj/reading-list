// Client-safe URL classification shared by the extraction pipeline
// (lib/extract/extractors.server.ts) and the in-app viewer
// (components/viewer/). Keep this module free of server-only imports.
import { getYouTubeVideoId } from "@/lib/url";

export type ContentKind = "youtube" | "arxiv" | "pdf" | "web";

// arXiv id from /abs/<id> or /pdf/<id>. Ids look like "2103.00020v2" or the
// older "cs/0112017" style.
export const getArxivId = (raw: string): string | null => {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "arxiv.org") return null;
    const match = url.pathname.match(/^\/(?:abs|pdf)\/(.+?)(?:\.pdf)?\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

// URL-shape PDF detection — the single source for cheap, sync PDF-URL
// resolution (lib/pdf-preview.server.ts builds on it for the async
// magic-number probe). PDFs only detectable by that probe are handled
// server-side by the web extractor's content-type sniff.
export const getPdfUrl = (raw: string): string | null => {
  try {
    const url = new URL(raw);
    const arxivId = getArxivId(raw);
    if (arxivId) return `https://arxiv.org/pdf/${arxivId}`;
    if (url.pathname.toLowerCase().endsWith(".pdf")) return url.toString();
    return null;
  } catch {
    return null;
  }
};

export const classifyUrl = (raw: string): ContentKind => {
  if (getYouTubeVideoId(raw)) return "youtube";
  if (getArxivId(raw)) return "arxiv";
  if (getPdfUrl(raw)) return "pdf";
  return "web";
};
