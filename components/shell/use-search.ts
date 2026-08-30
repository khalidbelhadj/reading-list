import { useQuery } from "@tanstack/react-query";
import React from "react";

import { searchItems } from "@/app/actions";
import { type Item } from "@/lib/types";
import { useDebounced } from "@/lib/use-debounced";

// A query wrapped in slashes (`/…/`) is a regex search — resolved entirely by
// the server's trigram pass, so the local keyword pass skips it.
const isRegexQuery = (query: string) => /^\/.*\/$/.test(query.trim());

/**
 * Two-pass search over the reading list.
 *
 * A synchronous local pass narrows the cached items on every keystroke
 * (title + url substring match), while a debounced server pass fuzzy-matches
 * notes and flashcard text via trigrams. Results merge local-first so the list
 * responds instantly and deepens as the server settles.
 *
 * - `order`         — merged item ids to show, or null when not searching
 * - `pending`       — nothing to show yet (regex queries are server-only)
 * - `serverPending` — local hits shown, server pass still settling; append
 *                     loading rows rather than replacing the list
 */
export const useItemSearch = (query: string, items: Item[] | undefined) => {
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebounced(trimmedQuery, 200);
  const isRegex = isRegexQuery(trimmedQuery);

  // Local pass — instant, against the already-cached items. Preserves list
  // order so local hits render stably at the top.
  const localOrder = React.useMemo(() => {
    if (isRegex || trimmedQuery.length === 0) return null;
    if (!items) return [];
    const needle = trimmedQuery.toLowerCase();
    return items
      .filter(
        (item) =>
          item.title.toLowerCase().includes(needle) ||
          item.url.toLowerCase().includes(needle),
      )
      .map((item) => item.id);
  }, [items, isRegex, trimmedQuery]);

  const { data: serverResults } = useQuery({
    queryKey: ["items", "search", debouncedQuery],
    queryFn: () => searchItems(debouncedQuery),
    enabled: debouncedQuery.length > 0,
    staleTime: Infinity,
  });

  // The server pass is fresh only when its debounced query matches the current
  // input. We intentionally don't gate on isFetching: a background refetch
  // (e.g. an item edit invalidating the query) keeps its prior data for the
  // same key, and we keep showing it instead of flashing skeletons.
  const serverFresh =
    debouncedQuery === trimmedQuery && serverResults !== undefined;

  const order = React.useMemo<string[] | null>(() => {
    if (trimmedQuery.length === 0) return null;
    const serverOrder = serverFresh
      ? serverResults!.map((result) => result.id)
      : null;
    if (localOrder && serverOrder) {
      const seen = new Set(localOrder);
      return [...localOrder, ...serverOrder.filter((id) => !seen.has(id))];
    }
    return localOrder ?? serverOrder;
  }, [localOrder, serverFresh, serverResults, trimmedQuery]);

  const active = trimmedQuery.length > 0;
  const pending = active && order === null;
  const serverPending = active && !serverFresh;
  const resultCount = serverPending ? null : (order?.length ?? null);

  return { active, order, pending, serverPending, resultCount, isRegex };
};
