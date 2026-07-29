// Full-document text search for the PDF engine.
//
// Pages are scanned lazily and in order, streaming results into the sidebar as
// they're found rather than blocking on a thousand-page sweep. Text content
// comes through the shared per-document cache, so a page the reader (or the
// text layer) has already touched costs nothing to search.
//
// Matching deliberately joins a page's text items with no separator: pdf.js
// splits runs mid-word constantly, and joining with spaces would make "search"
// unfindable whenever the glyph run breaks after "sea". The page highlight
// layer slices hits back onto spans the same way.
import type { PDFDocumentProxy } from "pdfjs-dist";
import React from "react";

import { getPageTextContent } from "@/lib/viewer/pdf-render";
import { findOccurrences, normalizeForSearch } from "@/lib/viewer/pdf-search";

const MAX_RESULTS = 500;
const SNIPPET_CONTEXT = 42;
const MIN_QUERY = 2;

export type PdfSearchMatch = {
  page: number;
  // Position of this match among the matches on its own page — what the page
  // component needs to know which highlight is the active one.
  ordinal: number;
  before: string;
  text: string;
  after: string;
};

export type PdfSearch = {
  query: string;
  setQuery: (query: string) => void;
  results: PdfSearchMatch[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  step: (direction: 1 | -1) => void;
  searching: boolean;
  clear: () => void;
};

export const usePdfSearch = (doc: PDFDocumentProxy | null): PdfSearch => {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PdfSearchMatch[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    const needle = normalizeForSearch(query.trim());
    setResults([]);
    setActiveIndex(0);
    if (!doc || needle.length < MIN_QUERY) {
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);

    void (async () => {
      const collected: PdfSearchMatch[] = [];
      for (let page = 1; page <= doc.numPages; page += 1) {
        if (cancelled) return;
        let raw: string;
        try {
          const content = await getPageTextContent(doc, page);
          raw = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join("");
        } catch {
          continue;
        }
        if (cancelled) return;
        const hits = findOccurrences(normalizeForSearch(raw), needle);
        for (const [ordinal, at] of hits.entries()) {
          if (collected.length >= MAX_RESULTS) break;
          const end = at + needle.length;
          collected.push({
            page,
            ordinal,
            before: raw.slice(Math.max(0, at - SNIPPET_CONTEXT), at),
            text: raw.slice(at, end),
            after: raw.slice(end, end + SNIPPET_CONTEXT),
          });
        }
        // Publish per page so long documents fill the list as they're scanned
        // instead of appearing all at once at the end.
        if (hits.length > 0) setResults([...collected]);
        if (collected.length >= MAX_RESULTS) break;
      }
      if (!cancelled) setSearching(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [doc, query]);

  const step = React.useCallback(
    (direction: 1 | -1) => {
      setActiveIndex((previous) =>
        results.length === 0
          ? 0
          : (previous + direction + results.length) % results.length,
      );
    },
    [results.length],
  );

  const clear = React.useCallback(() => {
    setQuery("");
    setResults([]);
    setActiveIndex(0);
  }, []);

  return {
    query,
    setQuery,
    results,
    activeIndex,
    setActiveIndex,
    step,
    searching,
    clear,
  };
};
