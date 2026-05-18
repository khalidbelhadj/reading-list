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
    queryKey: string;
    searchFn: (query: string) => Promise<Array<{ id: string }>>;
    onResults: (ids: Set<string> | null) => void;
    onQueryChange?: (query: string) => void;
    initialQuery?: string;
    placeholder?: string;
  }
>(({
  queryKey,
  searchFn,
  onResults,
  onQueryChange,
  initialQuery = "",
  placeholder = "Search...",
}, ref) => {
  const [isOpen, setIsOpen] = React.useState(() => initialQuery.length > 0);
  const [query, setQuery] = React.useState(initialQuery);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebounced(trimmedQuery, 200);
  const isRegex = /^\/.*\/$/.test(debouncedQuery);
  const queryRef = React.useRef(trimmedQuery);
  queryRef.current = trimmedQuery;

  const { data, isFetching } = useQuery({
    queryKey: [queryKey, debouncedQuery],
    queryFn: () => searchFn(debouncedQuery),
    enabled: debouncedQuery.length > 0,
    staleTime: 30_000,
  });

  React.useEffect(() => {
    if (debouncedQuery.length === 0 || queryRef.current.length === 0) {
      onResults(null);
      return;
    }
    if (data) {
      onResults(new Set(data.map((r) => r.id)));
    }
  }, [data, debouncedQuery, onResults]);

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

  const handleClose = React.useCallback(() => {
    setQuery("");
    onResults(null);
    setIsOpen(false);
  }, [onResults]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        inputRef.current?.blur();
      }
    },
    [],
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

  const resultCount = debouncedQuery.length > 0 && data ? data.length : null;

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
