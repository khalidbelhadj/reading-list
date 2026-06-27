import { useSearchParams } from "next/navigation";
import React from "react";

import { type Item } from "@/lib/types";

import { type SearchBarHandle } from "./search-bar";

/**
 * All state and callbacks for the reading-list search box.
 *
 * Search runs in two passes: a synchronous local pass over the in-memory cache
 * (instant, on every keystroke) and a backend trigram pass (fuzzy match on
 * notes/flashcard text). The three pending flags distinguish those phases:
 * - `searchPending`        — initial query resolving, list is replaced by skeletons
 * - `searchBackendPending` — local hits already shown, trigram pass still running
 *                            (we append loading rows under them rather than replace)
 *
 * The query is mirrored into the URL as `?q=` so it survives navigating away and
 * back; the initial value is captured once on mount from the URL.
 */
export const useListSearch = (items: Item[] | undefined) => {
  const searchParams = useSearchParams();

  const [initialSearchQuery] = React.useState(
    () => searchParams.get("q") ?? "",
  );
  const [searchOrder, setSearchOrder] = React.useState<string[] | null>(null);
  // Mirror of the live query text (the URL holds the canonical copy). Kept in
  // state so consumers can word UI around it, e.g. the "No results for …" empty
  // state. The list already re-renders per keystroke via `searchOrder`, so this
  // adds no extra renders.
  const [searchQuery, setSearchQuery] = React.useState(
    () => searchParams.get("q") ?? "",
  );
  const [searchPending, setSearchPending] = React.useState(
    () => initialSearchQuery.length > 0,
  );
  const [searchBackendPending, setSearchBackendPending] = React.useState(false);
  const searchBarRef = React.useRef<SearchBarHandle | null>(null);

  const searchActive = searchOrder !== null;

  const handleSearchResults = React.useCallback((ids: string[] | null) => {
    setSearchOrder(ids);
  }, []);

  const handleSearchPendingChange = React.useCallback((pending: boolean) => {
    setSearchPending(pending);
  }, []);

  const handleSearchBackendPendingChange = React.useCallback(
    (pending: boolean) => {
      setSearchBackendPending(pending);
    },
    [],
  );

  const handleSearchQueryChange = React.useCallback((query: string) => {
    setSearchQuery(query);
    const params = new URLSearchParams(window.location.search);
    const existing = params.get("q") ?? "";
    if (existing === query) return;
    if (query.length === 0) {
      params.delete("q");
    } else {
      params.set("q", query);
    }
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `?${queryString}` : window.location.pathname,
    );
  }, []);

  const handleSearchOpen = React.useCallback(() => {
    searchBarRef.current?.open();
  }, []);

  // Synchronous local search against the in-memory cache. Runs on every
  // keystroke so the list narrows instantly while the deeper server query
  // (trigram fuzzy on notes/flashcard text) is still in flight.
  const localSearchItems = React.useCallback(
    (query: string) => {
      if (!items) return [];
      const needle = query.toLowerCase();
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
    },
    [items],
  );

  return {
    searchBarRef,
    searchOrder,
    searchQuery,
    searchActive,
    searchPending,
    searchBackendPending,
    initialSearchQuery,
    localSearchItems,
    handleSearchResults,
    handleSearchQueryChange,
    handleSearchPendingChange,
    handleSearchBackendPendingChange,
    handleSearchOpen,
  };
};
