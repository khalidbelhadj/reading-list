import React from "react";
import { useQuery } from "@tanstack/react-query";

import { searchItems } from "@/app/actions";
import { type Item } from "@/lib/types";
import { useDebounced } from "@/lib/use-debounced";

import { type SearchBarHandle } from "./search-bar";

const SEARCH_QUERY_KEY = ["items", "search"] as const;

/**
 * The reading-list search engine. Owns the query text and derives everything the
 * list needs from it, so the search box ({@link SearchBar}) can stay a dumb
 * controlled input instead of owning this state and emitting it back up.
 *
 * Search runs in two passes: a synchronous local pass over the in-memory cache
 * (instant, on every keystroke) and a backend trigram pass (fuzzy match on
 * notes/flashcard text). The pending flags distinguish those phases:
 * - `searchPending`        — initial query resolving, list is replaced by skeletons
 * - `searchBackendPending` — local hits already shown, trigram pass still running
 *                            (we append loading rows under them rather than replace)
 *
 * The query is mirrored into the URL as `?q=` (on debounce settle) so it survives
 * navigating away and back; the initial value is captured once on mount.
 */
export const useListSearch = (items: Item[] | undefined) => {
  // Read once on mount straight from the URL (writes go through window.history
  // below). The SPA is client-only, so window is always present here.
  const [initialSearchQuery] = React.useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("q") ?? ""),
  );
  const [searchQuery, setSearchQuery] = React.useState(initialSearchQuery);
  const searchBarRef = React.useRef<SearchBarHandle | null>(null);

  const trimmedQuery = searchQuery.trim();
  const debouncedQuery = useDebounced(trimmedQuery, 200);
  const isRegex = /^\/.*\/$/.test(trimmedQuery);

  // Synchronous local pass — runs on every keystroke against already-cached data
  // so the list narrows the instant the user types. Skipped for regex
  // (server-only) and empty queries. Preserves insertion order so local hits
  // render first.
  const localOrder = React.useMemo(() => {
    if (isRegex || trimmedQuery.length === 0) return null;
    if (!items) return [];
    const needle = trimmedQuery.toLowerCase();
    const matches: string[] = [];
    for (const item of items) {
      if (
        item.title.toLowerCase().includes(needle) ||
        item.url.toLowerCase().includes(needle)
      ) {
        matches.push(item.id);
      }
    }
    return matches;
  }, [items, isRegex, trimmedQuery]);
  const localIdSet = React.useMemo(
    () => (localOrder ? new Set(localOrder) : null),
    [localOrder],
  );

  const { data, isFetching } = useQuery({
    queryKey: [...SEARCH_QUERY_KEY, debouncedQuery],
    queryFn: () => searchItems(debouncedQuery),
    enabled: debouncedQuery.length > 0,
    staleTime: Infinity,
  });

  // On cold mount with an initial query (e.g. user navigated back to ?q=foo),
  // results aren't in yet — but if local search already has a synchronous result
  // set we only signal pending when we have neither.
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(
    initialSearchQuery.length === 0,
  );
  React.useEffect(() => {
    if (data !== undefined && !hasLoadedOnce) setHasLoadedOnce(true);
  }, [data, hasLoadedOnce]);
  const searchPending =
    !hasLoadedOnce && trimmedQuery.length > 0 && localOrder === null;

  // The backend (trigram) pass hasn't settled for the *current* input yet —
  // either we're still inside the debounce window (debounced query lags the
  // input) or its fetch is in flight (no data for that key). Drives the "more
  // results loading" skeletons appended under the instant local hits. We gate on
  // data being present rather than isFetching, so a background refetch (e.g. an
  // item edit invalidating the query) doesn't re-flash the skeletons.
  const searchBackendPending =
    trimmedQuery.length > 0 &&
    !(debouncedQuery === trimmedQuery && data !== undefined);

  // Merge local + server ids into the display order. Server data is fresh as long
  // as its debounced query matches the current input and we have results. We
  // intentionally do NOT gate on isFetching: when items are invalidated (e.g.
  // after editing an item) the search query refetches in the background and React
  // Query keeps the prior data for the same key — so we keep showing it instead
  // of flashing the unfiltered list.
  const searchOrder = React.useMemo<string[] | null>(() => {
    if (trimmedQuery.length === 0) return null;
    const serverFresh = debouncedQuery === trimmedQuery && !!data;
    const serverOrder = serverFresh && data ? data.map((r) => r.id) : null;
    if (localOrder && serverOrder) {
      const merged = [...localOrder];
      const seen = localIdSet!;
      for (const id of serverOrder) if (!seen.has(id)) merged.push(id);
      return merged;
    }
    if (localOrder) return localOrder;
    if (serverOrder) return serverOrder;
    return null;
  }, [localOrder, localIdSet, data, debouncedQuery, trimmedQuery]);

  const searchActive = searchOrder !== null;

  const resultCount = React.useMemo(() => {
    if (trimmedQuery.length === 0) return null;
    const serverFresh = debouncedQuery === trimmedQuery && !!data;
    if (localIdSet && serverFresh && data) {
      let extra = 0;
      for (const r of data) if (!localIdSet.has(r.id)) extra++;
      return localIdSet.size + extra;
    }
    if (localIdSet) return localIdSet.size;
    if (serverFresh && data) return data.length;
    return null;
  }, [localIdSet, data, debouncedQuery, trimmedQuery]);

  // Only sync the URL when the debounced query settles — typing should feel
  // instant, not pay a history.replaceState cost on every keystroke.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const existing = params.get("q") ?? "";
    if (existing === debouncedQuery) return;
    if (debouncedQuery.length === 0) params.delete("q");
    else params.set("q", debouncedQuery);
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `?${queryString}` : window.location.pathname,
    );
  }, [debouncedQuery]);

  const handleSearchOpen = React.useCallback(() => {
    searchBarRef.current?.open();
  }, []);

  return {
    searchBarRef,
    searchQuery,
    setSearchQuery,
    isRegex,
    isFetching,
    resultCount,
    searchOrder,
    searchActive,
    searchPending,
    searchBackendPending,
    handleSearchOpen,
  };
};
