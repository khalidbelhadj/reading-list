import React from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import { useDebounced } from "@/lib/use-debounced";
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
    onCursorNav?: (direction: "next" | "prev") => void;
    onCursorOpen?: (modifier: { meta: boolean; shift: boolean }) => void;
    initialQuery?: string;
    placeholder?: string;
  }
>(({
  queryKey,
  searchFn,
  localSearchFn,
  onResults,
  onQueryChange,
  onPendingChange,
  onCursorNav,
  onCursorOpen,
  initialQuery = "",
  placeholder = "Search",
}, ref) => {
  const [isOpen, setIsOpen] = React.useState(() => initialQuery.length > 0);
  const [query, setQuery] = React.useState(initialQuery);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
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
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(initialQuery.length === 0);
  React.useEffect(() => {
    if (data !== undefined && !hasLoadedOnce) setHasLoadedOnce(true);
  }, [data, hasLoadedOnce]);
  const initialPending =
    !hasLoadedOnce && trimmedQuery.length > 0 && localOrder === null;
  React.useEffect(() => {
    onPendingChange?.(initialPending);
  }, [initialPending, onPendingChange]);

  React.useEffect(() => {
    if (trimmedQuery.length === 0) {
      onResults(null);
      return;
    }
    // Server data is only considered fresh when its debounced query matches
    // the current input and a fetch isn't in flight.
    const serverFresh = debouncedQuery === trimmedQuery && !isFetching && !!data;
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
  }, [localOrder, localIdSet, data, debouncedQuery, trimmedQuery, isFetching, onResults]);

  // Only sync the URL when the debounced query settles — typing should feel
  // instant, not pay a history.replaceState cost on every keystroke.
  React.useEffect(() => {
    onQueryChange?.(debouncedQuery);
  }, [debouncedQuery, onQueryChange]);

  React.useImperativeHandle(ref, () => ({
    open: () => {
      setIsOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  }), []);

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
        // Defer ESC to the item panel when it's open — first ESC should
        // close the panel, leaving the search query/focus intact.
        if (document.querySelector('[data-phase]:not([data-phase="closed"])')) {
          return;
        }
        e.stopPropagation();
        inputRef.current?.blur();
        return;
      }
      const isNext =
        (e.key === "ArrowDown" && !e.metaKey && !e.altKey && !e.shiftKey) ||
        (e.code === "KeyN" && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey);
      const isPrev =
        (e.key === "ArrowUp" && !e.metaKey && !e.altKey && !e.shiftKey) ||
        (e.code === "KeyP" && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey);
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
        onCursorOpen?.({ meta: e.metaKey || e.ctrlKey, shift: e.shiftKey });
        return;
      }
    },
    [onCursorNav, onCursorOpen],
  );

  const handleBlur = React.useCallback(() => {
    if (query.length === 0) {
      handleClose();
    }
  }, [query, handleClose]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, handleClose]);

  const resultCount = React.useMemo(() => {
    if (trimmedQuery.length === 0) return null;
    const serverFresh = debouncedQuery === trimmedQuery && !isFetching && !!data;
    if (localIdSet && serverFresh && data) {
      let extra = 0;
      for (const r of data) if (!localIdSet.has(r.id)) extra++;
      return localIdSet.size + extra;
    }
    if (localIdSet) return localIdSet.size;
    if (serverFresh && data) return data.length;
    return null;
  }, [localIdSet, data, debouncedQuery, trimmedQuery, isFetching]);

  return (
    <div
      className="overflow-hidden transition-[height,margin-bottom] duration-100"
      style={
        isOpen
          ? { height: "auto", marginBottom: 0 }
          : { height: 0, marginBottom: "-0.75rem" }
      }
    >
      <div className="relative flex items-center">
        <IconSearch className="absolute left-2.5 size-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="h-8 w-full rounded-md bg-muted pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground transition-colors"
          tabIndex={isOpen ? 0 : -1}
        />
        {query.length > 0 && (
          <div className="absolute right-1 flex items-center gap-1">
            {isRegex && (
              <span className="text-[10px] font-medium text-muted-foreground bg-background rounded px-1 py-0.5 select-none">
                regex
              </span>
            )}
            {isFetching ? (
              <Spinner className="size-3.5" />
            ) : resultCount !== null ? (
              <span className="text-[11px] tabular-nums text-muted-foreground select-none">
                {resultCount}
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleClose}
              className="p-0.5 text-muted-foreground hover:text-foreground rounded-sm"
            >
              <IconX className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

SearchBar.displayName = "SearchBar";
