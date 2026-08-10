import React from "react";

import { isElectron } from "@/lib/platform";

// The home layout's view, split into four independent facets and mirrored to
// the query string so every one of them is deep-linkable and survives reload
// and back/forward:
//
//   ?item=<id>     the item panel's item
//   ?expanded=1    that panel shown expanded rather than as a side preview
//   ?read=<id>     the reading panel (mini browser / reader / pdf / video)
//   ?readerFull=1  the reader filling the whole layout area
//
// The hook owns the URL↔state mirror only. What the facets mean together, and
// which combinations are legal, stays in the layout that calls it.
//
// One exception, and it belongs here rather than in the layout because it is a
// fact about reading the URL: the reader is desktop-only (see
// dispatchReadItem), so ?read= is ignored on the web app. A shared or
// bookmarked reading URL opens the item panel there instead of a reader the
// web build cannot host.
export type PanelView = {
  openItemId: string | null;
  expanded: boolean;
  readingItemId: string | null;
  readerExpanded: boolean;
  applyView: (next: PanelViewPatch, opts?: { push?: boolean }) => void;
};

type PanelViewPatch = {
  item?: string | null;
  read?: string | null;
  expanded?: boolean;
  readerFull?: boolean;
};

const param = (name: string): string | null => {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
};

const readParam = (params: URLSearchParams): string | null =>
  isElectron() ? params.get("read") : null;

export const usePanelView = (): PanelView => {
  const [openItemId, setOpenItemId] = React.useState<string | null>(() =>
    param("item"),
  );
  const [expanded, setExpanded] = React.useState<boolean>(
    () => param("expanded") != null,
  );
  const [readingItemId, setReadingItemId] = React.useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : readParam(new URLSearchParams(window.location.search)),
  );
  const [readerExpanded, setReaderExpanded] = React.useState<boolean>(
    () => param("readerFull") != null,
  );

  React.useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      setOpenItemId(params.get("item"));
      setExpanded(params.get("expanded") != null);
      setReadingItemId(readParam(params));
      setReaderExpanded(params.get("readerFull") != null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // The single URL writer: applies a partial view to both the query string and
  // the mirrored state in one place. `undefined` leaves a facet untouched;
  // `null` clears it. Callers stay 1–3 line statements of intent and choose
  // push (a new navigational place) vs replace (refining the current one).
  const applyView = React.useCallback(
    (next: PanelViewPatch, opts?: { push?: boolean }) => {
      const params = new URLSearchParams(window.location.search);
      if (next.item !== undefined) {
        if (next.item === null) params.delete("item");
        else params.set("item", next.item);
      }
      if (next.read !== undefined) {
        if (next.read === null) params.delete("read");
        else params.set("read", next.read);
      }
      if (next.expanded !== undefined) {
        if (next.expanded) params.set("expanded", "1");
        else params.delete("expanded");
      }
      if (next.readerFull !== undefined) {
        if (next.readerFull) params.set("readerFull", "1");
        else params.delete("readerFull");
      }
      const qs = params.toString();
      const url = qs ? `?${qs}` : window.location.pathname;
      if (opts?.push) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
      if (next.item !== undefined) setOpenItemId(next.item);
      if (next.read !== undefined) setReadingItemId(next.read);
      if (next.expanded !== undefined) setExpanded(next.expanded);
      if (next.readerFull !== undefined) setReaderExpanded(next.readerFull);
    },
    [],
  );

  return { openItemId, expanded, readingItemId, readerExpanded, applyView };
};
