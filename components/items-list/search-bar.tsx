import React from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import { useDebounced } from "@/lib/use-debounced";
import { isModKey } from "@/lib/input-context";
import { useDismissLayer } from "@/lib/use-dismiss-layer";
import { Spinner } from "@/components/ui/spinner";

export type SearchBarHandle = {
  open: () => void;
};

export const SearchBar = React.forwardRef<
  SearchBarHandle,
  {
    queryKey: readonly unknown[];
    searchFn: (query: string) => Promise<Array<{ id: string }>>;
    localSearchFn?: (query: string) => string[];
    onResults: (ids: string[] | null) => void;
    onQueryChange?: (query: string) => void;
    onPendingChange?: (pending: boolean) => void;
    onBackendPendingChange?: (pending: boolean) => void;
    onCursorNav?: (direction: "next" | "prev") => void;
    onCursorJump?: (edge: "start" | "end") => void;
    onCursorOpen?: (modifier: { meta: boolean; shift: boolean }) => void;
    initialQuery?: string;
    placeholder?: string;
  }
>(
  (
    {
      queryKey,
      searchFn,
      localSearchFn,
      onResults,
      onQueryChange,
      onPendingChange,
      onBackendPendingChange,
      onCursorNav,
      onCursorJump,
      onCursorOpen,
      initialQuery = "",
      placeholder = "Search",
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = React.useState(() => initialQuery.length > 0);
    const [query, setQuery] = React.useState(initialQuery);
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const trimmedQuery = query.trim();
    const debouncedQuery = useDebounced(trimmedQuery, 200);
    const isRegex = /^\/.*\/$/.test(trimmedQuery);
    const queryRef = React.useRef(trimmedQuery);
    queryRef.current = trimmedQuery;

    // Synchronous local pass — runs on every keystroke against already-cached
    // data so the list narrows the instant the user types. Skipped for regex
    // (server-only) and when no local search function is provided. Preserves
    // insertion order so the parent can render local hits first.
    const localOrder = React.useMemo(() => {
      if (!localSearchFn || isRegex || trimmedQuery.length === 0) return null;
      return localSearchFn(trimmedQuery);
    }, [localSearchFn, isRegex, trimmedQuery]);
    const localIdSet = React.useMemo(
      () => (localOrder ? new Set(localOrder) : null),
      [localOrder],
    );

    const { data, isFetching } = useQuery({
      queryKey: [...queryKey, debouncedQuery],
      queryFn: () => searchFn(debouncedQuery),
      enabled: debouncedQuery.length > 0,
      staleTime: Infinity,
    });

    // On cold mount with an initial query (e.g. user navigated back to ?q=foo),
    // results aren't in yet — but if local search is enabled we already have a
    // synchronous result set, so only signal pending when we have neither.
    const [hasLoadedOnce, setHasLoadedOnce] = React.useState(
      initialQuery.length === 0,
    );
    React.useEffect(() => {
      if (data !== undefined && !hasLoadedOnce) setHasLoadedOnce(true);
    }, [data, hasLoadedOnce]);
    const initialPending =
      !hasLoadedOnce && trimmedQuery.length > 0 && localOrder === null;
    React.useEffect(() => {
      onPendingChange?.(initialPending);
    }, [initialPending, onPendingChange]);

    // The backend (trigram) pass hasn't settled for the *current* input yet —
    // either we're still inside the debounce window (debounced query lags the
    // input) or its fetch is in flight (no data for that key). Drives the
    // "more results loading" skeletons appended under the instant local hits. We
    // gate on data being present rather than isFetching, so a background refetch
    // (e.g. an item edit invalidating the query) doesn't re-flash the skeletons.
    const backendPending =
      trimmedQuery.length > 0 &&
      !(debouncedQuery === trimmedQuery && data !== undefined);
    React.useEffect(() => {
      onBackendPendingChange?.(backendPending);
    }, [backendPending, onBackendPendingChange]);

    React.useEffect(() => {
      if (trimmedQuery.length === 0) {
        onResults(null);
        return;
      }
      // Server data is fresh as long as its debounced query matches the current
      // input and we have results. We intentionally do NOT gate on isFetching:
      // when items are invalidated (e.g. after editing an item) the search query
      // refetches in the background, and React Query keeps the prior data for the
      // same key — so we keep showing it instead of flashing the unfiltered list.
      const serverFresh = debouncedQuery === trimmedQuery && !!data;
      const serverOrder = serverFresh && data ? data.map((r) => r.id) : null;

      if (localOrder && serverOrder) {
        const merged = [...localOrder];
        const seen = localIdSet!;
        for (const id of serverOrder) if (!seen.has(id)) merged.push(id);
        onResults(merged);
        return;
      }
      if (localOrder) {
        onResults(localOrder);
        return;
      }
      if (serverOrder) {
        onResults(serverOrder);
        return;
      }
      onResults(null);
    }, [
      localOrder,
      localIdSet,
      data,
      debouncedQuery,
      trimmedQuery,
      isFetching,
      onResults,
    ]);

    // Only sync the URL when the debounced query settles — typing should feel
    // instant, not pay a history.replaceState cost on every keystroke.
    React.useEffect(() => {
      onQueryChange?.(debouncedQuery);
    }, [debouncedQuery, onQueryChange]);

    React.useImperativeHandle(
      ref,
      () => ({
        open: () => {
          setIsOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        },
      }),
      [],
    );

    // If we land mounted with an active query (e.g. user navigated back from an
    // item page while a search was in progress), put focus on the input so they
    // can keep refining without an extra click.
    React.useEffect(() => {
      if (initialQuery.length === 0) return;
      requestAnimationFrame(() => inputRef.current?.focus());
      // initialQuery is captured once at mount on the parent side, so this only
      // fires on the initial mount.
    }, [initialQuery]);

    const handleClose = React.useCallback(() => {
      setQuery("");
      onResults(null);
      setIsOpen(false);
    }, [onResults]);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
          // First Escape just blurs the input — the bar stays open with results
          // visible. The dismiss-stack layer below handles the next Escape, which
          // closes the bar. (An empty query collapses both steps: blurring fires
          // handleBlur → handleClose.)
          if (document.activeElement === inputRef.current) {
            // preventDefault (not just stopPropagation) is what actually isolates
            // this Escape from the global dismiss dispatcher. React 19 delegates
            // events on `document`, the same node the dispatcher listens on, so a
            // synthetic stopPropagation() doesn't stop that sibling listener —
            // only marking the event handled (defaultPrevented) makes the
            // dispatcher bail (see lib/dismiss-stack.ts). Without this, the same
            // Escape closes the bar AND pops the next layer (the item panel).
            e.preventDefault();
            e.stopPropagation();
            inputRef.current?.blur();
          }
          return;
        }
        // Jump to first / last result — mirrors the global list shortcuts so
        // the cursor can leap to either end without leaving the search input.
        // ⌘↑ / ⌘⇧< → start, ⌘↓ / ⌘⇧> → end.
        const isJumpStart =
          (e.key === "ArrowUp" && isModKey(e) && !e.altKey && !e.shiftKey) ||
          ((e.key === "<" || e.code === "Comma") &&
            isModKey(e) &&
            e.shiftKey &&
            !e.altKey);
        const isJumpEnd =
          (e.key === "ArrowDown" && isModKey(e) && !e.altKey && !e.shiftKey) ||
          ((e.key === ">" || e.code === "Period") &&
            isModKey(e) &&
            e.shiftKey &&
            !e.altKey);
        if (isJumpStart || isJumpEnd) {
          e.preventDefault();
          onCursorJump?.(isJumpStart ? "start" : "end");
          return;
        }
        const isNext =
          (e.key === "ArrowDown" && !e.metaKey && !e.altKey && !e.shiftKey) ||
          (e.code === "KeyN" &&
            e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            !e.shiftKey);
        const isPrev =
          (e.key === "ArrowUp" && !e.metaKey && !e.altKey && !e.shiftKey) ||
          (e.code === "KeyP" &&
            e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            !e.shiftKey);
        if (isNext) {
          e.preventDefault();
          onCursorNav?.("next");
          return;
        }
        if (isPrev) {
          e.preventDefault();
          onCursorNav?.("prev");
          return;
        }
        if (e.key === "Enter" && !e.altKey) {
          e.preventDefault();
          onCursorOpen?.({ meta: isModKey(e), shift: e.shiftKey });
          return;
        }
      },
      [onCursorNav, onCursorJump, onCursorOpen],
    );

    const handleBlur = React.useCallback(() => {
      if (query.length === 0) {
        handleClose();
      }
    }, [query, handleClose]);

    // The open search bar is a dismiss-stack layer: once the input is blurred,
    // Escape closes the bar (clearing the query). `contains` lets re-focusing the
    // search input promote it above an older layer like an open item panel.
    useDismissLayer({
      active: isOpen,
      onDismiss: handleClose,
      contains: (node) => containerRef.current?.contains(node) ?? false,
    });

    // When the bar collapses (height 0), drop focus from the now-hidden input.
    // A focused-but-hidden input keeps swallowing keystrokes, which blocks the
    // global list-navigation shortcuts (j/k, Ctrl+N/P, etc.).
    React.useEffect(() => {
      if (!isOpen && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    }, [isOpen]);

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

    return (
      <div
        ref={containerRef}
        className="overflow-hidden transition-[height,margin-bottom] duration-100"
        style={
          isOpen
            ? { height: "auto", marginBottom: 0 }
            : { height: 0, marginBottom: "-0.75rem" }
        }
      >
        <div className="relative flex items-center">
          <IconSearch className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="h-8 w-full rounded-md bg-muted pr-8 pl-8 text-sm transition-colors outline-none placeholder:text-muted-foreground"
            tabIndex={isOpen ? 0 : -1}
          />
          {query.length > 0 && (
            <div className="absolute right-1 flex items-center gap-1">
              {isRegex && (
                <span className="rounded bg-background px-1 py-0.5 text-[10px] font-medium text-muted-foreground select-none">
                  regex
                </span>
              )}
              {/* Keep the count visible whenever we have one — including while a
                background refetch is in flight (e.g. an item edit invalidated
                the search). Only fall back to the spinner when there's nothing
                to show yet, so a background refetch doesn't flash "searching". */}
              {resultCount !== null ? (
                <span className="text-[11px] text-muted-foreground tabular-nums select-none">
                  {resultCount}
                </span>
              ) : isFetching ? (
                <Spinner className="size-3.5" />
              ) : null}
              <button
                type="button"
                onClick={handleClose}
                className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              >
                <IconX className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  },
);

SearchBar.displayName = "SearchBar";
