// Client-safe URL-shape PDF detection, shared by the server-side preview
// renderer (lib/pdf-preview.server.ts) and title resolution
// (lib/page-title.server.ts).

// arXiv id from /abs/<id> or /pdf/<id>. Ids look like "2103.00020v2" or the
// older "cs/0112017" style.
const getArxivId = (raw: string): string | null => {
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

// The single source for cheap, sync PDF-URL resolution
// (lib/pdf-preview.server.ts builds on it for the async magic-number probe).
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
