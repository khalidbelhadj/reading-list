import React from "react";

import { isModKey } from "@/lib/input-context";

// Panel-scoped Cmd+F search. Highlighting is done via the CSS Custom
// Highlights API (CSS.highlights) — Range objects are registered under
// named highlights and painted by `::highlight(name)` CSS rules. No DOM
// mutation, so contenteditable surfaces (title, URL) and ProseMirror
// editors (notes, flashcards) are untouched. Trade-off: the spec doesn't
// allow border-radius on ::highlight(), so corners are square.
//
// For any raw <input>/<textarea> inside the panel (e.g. the tag-input
// new-tag field), the API can't paint — so we fall back to the element's
// native selection (setSelectionRange). Those matches still participate in
// the count and prev/next cycle.

const HIGHLIGHT_NAME = "panel-find";
const HIGHLIGHT_ACTIVE_NAME = "panel-find-active";

// The CSS Custom Highlights API isn't yet in every TS lib.dom version, so
// we narrow via local type aliases.
type HighlightCtor = new (...ranges: Range[]) => Highlight;
type HighlightRegistry = Map<string, Highlight> & {
  set(name: string, value: Highlight): HighlightRegistry;
  delete(name: string): boolean;
};
type CSSWithHighlights = typeof CSS & { highlights?: HighlightRegistry };

const supportsHighlights = () =>
  typeof CSS !== "undefined" &&
  !!(CSS as CSSWithHighlights).highlights &&
  typeof Highlight !== "undefined";

// Inject ::highlight() rules at runtime rather than shipping them through
// globals.css: Lightning CSS (used by CSS build pipelines this app has run
// under) rejects ::highlight() at parse time, and runtime injection sidesteps
// the build tooling entirely.
const HIGHLIGHT_STYLE_ID = "panel-find-highlight-style";
const ensureHighlightStyles = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
    ::highlight(${HIGHLIGHT_NAME}) {
      background-color: oklch(0.92 0.13 95);
      color: oklch(0.2 0.02 95);
    }
    ::highlight(${HIGHLIGHT_ACTIVE_NAME}) {
      background-color: oklch(0.78 0.18 65);
      color: oklch(0.2 0.02 65);
    }
  `;
  document.head.appendChild(style);
};

const setHighlightRanges = (name: string, ranges: Range[]) => {
  const c = CSS as CSSWithHighlights;
  if (!c.highlights) return;
  if (ranges.length === 0) {
    c.highlights.delete(name);
    return;
  }
  const Ctor = Highlight as unknown as HighlightCtor;
  c.highlights.set(name, new Ctor(...ranges));
};

const clearHighlightRanges = () => {
  const c = CSS as CSSWithHighlights;
  if (!c.highlights) return;
  c.highlights.delete(HIGHLIGHT_NAME);
  c.highlights.delete(HIGHLIGHT_ACTIVE_NAME);
};

type DomMatch = { kind: "dom"; range: Range };
type FieldMatch = {
  kind: "field";
  element: HTMLInputElement | HTMLTextAreaElement;
  start: number;
  end: number;
};
type Match = DomMatch | FieldMatch;

const collectDomMatches = (root: HTMLElement, query: string): DomMatch[] => {
  const matches: DomMatch[] = [];
  if (!query) return matches;
  const lower = query.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-find-bar]")) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
        return NodeFilter.FILTER_REJECT;
      }
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode();
  while (node) {
    const text = node.nodeValue ?? "";
    const haystack = text.toLowerCase();
    let from = 0;
    while (from <= haystack.length) {
      const idx = haystack.indexOf(lower, from);
      if (idx === -1) break;
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + lower.length);
      matches.push({ kind: "dom", range });
      from = idx + lower.length;
      if (lower.length === 0) break;
    }
    node = walker.nextNode();
  }
  return matches;
};

const collectFieldMatches = (
  root: HTMLElement,
  query: string,
): FieldMatch[] => {
  const matches: FieldMatch[] = [];
  if (!query) return matches;
  const lower = query.toLowerCase();
  const fields = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );
  fields.forEach((el) => {
    if (el.type === "password" || el.type === "hidden") return;
    if (el.closest("[data-find-bar]")) return;
    const haystack = (el.value ?? "").toLowerCase();
    let from = 0;
    while (from <= haystack.length) {
      const idx = haystack.indexOf(lower, from);
      if (idx === -1) break;
      matches.push({
        kind: "field",
        element: el,
        start: idx,
        end: idx + lower.length,
      });
      from = idx + lower.length;
      if (lower.length === 0) break;
    }
  });
  return matches;
};

// Document order so prev/next reads like the user expects.
const sortMatches = (a: Match, b: Match): number => {
  const aEl =
    a.kind === "dom" ? a.range.startContainer.parentElement : a.element;
  const bEl =
    b.kind === "dom" ? b.range.startContainer.parentElement : b.element;
  if (!aEl || !bEl || aEl === bEl) {
    if (a.kind === "dom" && b.kind === "dom") {
      return a.range.compareBoundaryPoints(Range.START_TO_START, b.range);
    }
    if (a.kind === "field" && b.kind === "field") return a.start - b.start;
    return 0;
  }
  const pos = aEl.compareDocumentPosition(bEl);
  if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
};

// Custom rAF-based smooth scroll. The native `behavior: "smooth"` has no
// duration knob and runs ~400ms, which feels sluggish for find-next.
const SCROLL_DURATION_MS = 150;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const activeScrollRef: { id: number | null } = { id: null };

const animateScroll = (scroller: HTMLElement, delta: number) => {
  if (delta === 0) return;
  if (activeScrollRef.id !== null) cancelAnimationFrame(activeScrollRef.id);
  const startTop = scroller.scrollTop;
  const startTime = performance.now();
  const step = (now: number) => {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / SCROLL_DURATION_MS);
    scroller.scrollTop = startTop + delta * easeOutCubic(t);
    if (t < 1) {
      activeScrollRef.id = requestAnimationFrame(step);
    } else {
      activeScrollRef.id = null;
    }
  };
  activeScrollRef.id = requestAnimationFrame(step);
};

const scrollMatchIntoView = (match: Match, scroller: HTMLElement) => {
  const rect =
    match.kind === "dom"
      ? match.range.getBoundingClientRect()
      : match.element.getBoundingClientRect();
  const sRect = scroller.getBoundingClientRect();
  const margin = 80;
  if (rect.top < sRect.top + margin) {
    animateScroll(scroller, rect.top - sRect.top - margin);
  } else if (rect.bottom > sRect.bottom - margin) {
    animateScroll(scroller, rect.bottom - sRect.bottom + margin);
  }
};

export type PanelFind = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  query: string;
  setQuery: (q: string) => void;
  currentIndex: number;
  total: number;
  next: () => void;
  prev: () => void;
};

export const usePanelFind = ({
  scrollRef,
  enabled,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
}): PanelFind => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [total, setTotal] = React.useState(0);

  const matchesRef = React.useRef<Match[]>([]);
  const currentIndexRef = React.useRef(0);
  currentIndexRef.current = currentIndex;

  const applyHighlights = React.useCallback((active: number) => {
    const matches = matchesRef.current;
    const domRanges: Range[] = [];
    const activeDomRanges: Range[] = [];
    matches.forEach((m, i) => {
      if (m.kind !== "dom") return;
      if (i === active) activeDomRanges.push(m.range);
      else domRanges.push(m.range);
    });
    setHighlightRanges(HIGHLIGHT_NAME, domRanges);
    setHighlightRanges(HIGHLIGHT_ACTIVE_NAME, activeDomRanges);

    const activeMatch = matches[active];
    if (activeMatch?.kind === "field") {
      try {
        activeMatch.element.setSelectionRange(
          activeMatch.start,
          activeMatch.end,
        );
      } catch {
        // setSelectionRange isn't supported on every input type — ignore.
      }
    }
  }, []);

  const recompute = React.useCallback(() => {
    const root = scrollRef.current;
    if (!root || !query) {
      matchesRef.current = [];
      setTotal(0);
      setCurrentIndex(0);
      clearHighlightRanges();
      return;
    }
    if (!supportsHighlights()) {
      matchesRef.current = [];
      setTotal(0);
      setCurrentIndex(0);
      return;
    }
    const dom = collectDomMatches(root, query);
    const field = collectFieldMatches(root, query);
    const all: Match[] = [...dom, ...field].sort(sortMatches);
    matchesRef.current = all;
    setTotal(all.length);
    const nextIndex =
      all.length === 0 ? 0 : Math.min(currentIndexRef.current, all.length - 1);
    setCurrentIndex(nextIndex);
    applyHighlights(nextIndex);
    const nextMatch = all[nextIndex];
    if (nextMatch) scrollMatchIntoView(nextMatch, root);
  }, [query, scrollRef, applyHighlights]);

  // Recompute when query changes or the bar opens. useLayoutEffect (rather
  // than useEffect) so the new total flushes in the same paint as the
  // setQuery that triggered it — otherwise the user sees a one-frame
  // "0/0 (red)" flash before the real count appears.
  React.useLayoutEffect(() => {
    if (!isOpen) return;
    recompute();
  }, [isOpen, query, recompute]);

  // Recompute when panel content mutates (notes/flashcards typing, etc.).
  // Debounced — ProseMirror fires a lot during edits.
  React.useEffect(() => {
    if (!isOpen) return;
    const root = scrollRef.current;
    if (!root) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => recompute(), 100);
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    const onInput = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => recompute(), 100);
    };
    root.addEventListener("input", onInput);
    return () => {
      observer.disconnect();
      root.removeEventListener("input", onInput);
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, scrollRef, recompute]);

  // Clear and reset when the bar closes.
  React.useEffect(() => {
    if (isOpen) return;
    matchesRef.current = [];
    setTotal(0);
    setCurrentIndex(0);
    clearHighlightRanges();
  }, [isOpen]);

  // Clear highlights on unmount.
  React.useEffect(() => {
    return () => clearHighlightRanges();
  }, []);

  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  const goTo = React.useCallback(
    (index: number) => {
      const matches = matchesRef.current;
      if (matches.length === 0) return;
      const wrapped =
        ((index % matches.length) + matches.length) % matches.length;
      setCurrentIndex(wrapped);
      applyHighlights(wrapped);
      const root = scrollRef.current;
      const match = matches[wrapped];
      if (root && match) scrollMatchIntoView(match, root);
    },
    [applyHighlights, scrollRef],
  );

  const next = React.useCallback(
    () => goTo(currentIndexRef.current + 1),
    [goTo],
  );
  const prev = React.useCallback(
    () => goTo(currentIndexRef.current - 1),
    [goTo],
  );

  // Global Cmd/Ctrl+F when the panel is enabled.
  React.useEffect(() => {
    if (!enabled) return;
    ensureHighlightStyles();
    const onKey = (e: KeyboardEvent) => {
      const isFind = isModKey(e) && e.key.toLowerCase() === "f";
      if (!isFind) return;
      e.preventDefault();
      setIsOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  // Auto-close when the panel closes.
  React.useEffect(() => {
    if (!enabled && isOpen) setIsOpen(false);
  }, [enabled, isOpen]);

  return {
    isOpen,
    open,
    close,
    query,
    setQuery,
    currentIndex,
    total,
    next,
    prev,
  };
};
