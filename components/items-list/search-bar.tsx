import { IconSearch, IconX } from "@tabler/icons-react";
import React from "react";

import { Spinner } from "@/components/ui/spinner";
import { isModKey } from "@/lib/input-context";
import { cn } from "@/lib/utils";
import { useDismissLayer } from "@/lib/use-dismiss-layer";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export type SearchBarHandle = {
  open: () => void;
};

/**
 * Controlled presentational search input. The query text and all search results
 * live in {@link useListSearch}; this component only renders the field, animates
 * open/closed, manages focus + the dismiss layer, and delegates cursor keys
 * (arrows / Ctrl+N/P / Enter / ⌘↑↓) to the list.
 */
export const SearchBar = React.forwardRef<
  SearchBarHandle,
  {
    query: string;
    onQueryChange: (query: string) => void;
    resultCount: number | null;
    isFetching: boolean;
    // Hand the current query to agentic search — fired by the inline "Ask"
    // button and the ⌘/Ctrl+Enter shortcut.
    onAsk?: (query: string) => void;
    // True while an Ask request is in flight; disables the inline button.
    isAsking?: boolean;
    onCursorNav?: (direction: "next" | "prev") => void;
    onCursorJump?: (edge: "start" | "end") => void;
    onCursorOpen?: (modifier: { meta: boolean; shift: boolean }) => void;
    placeholder?: string;
  }
>(
  (
    {
      query,
      onQueryChange,
      resultCount,
      isFetching,
      onAsk,
      isAsking = false,
      onCursorNav,
      onCursorJump,
      onCursorOpen,
      placeholder = "Search",
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = React.useState(() => query.length > 0);
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const isRegex = /^\/.*\/$/.test(query.trim());

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
    // can keep refining without an extra click. Captured once at mount.
    const openedWithQueryRef = React.useRef(query.length > 0);
    React.useEffect(() => {
      if (openedWithQueryRef.current) {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }, []);

    const handleClose = React.useCallback(() => {
      onQueryChange("");
      setIsOpen(false);
    }, [onQueryChange]);

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
        // ⌥/Alt+Enter hands the query to agentic search. (⌘+Enter is taken by
        // open-expanded, ⌘⇧+Enter by open-in-browser; Alt+Enter is the only free
        // Enter combo here.) Plain Enter still opens the focused result.
        if (e.key === "Enter" && e.altKey) {
          const trimmed = query.trim();
          if (trimmed.length === 0) return;
          e.preventDefault();
          onAsk?.(trimmed);
          return;
        }
        if (e.key === "Enter" && !e.altKey) {
          e.preventDefault();
          onCursorOpen?.({ meta: isModKey(e), shift: e.shiftKey });
          return;
        }
      },
      [onCursorNav, onCursorJump, onCursorOpen, onAsk, query],
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
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={cn(
              "h-8 w-full rounded-md bg-muted pl-8 text-sm transition-colors outline-none placeholder:text-muted-foreground",
              // Reserve room for the inline cluster (count + close + Ask button)
              // so typed text never slides underneath it.
              query.trim().length > 0 ? "pr-28" : "pr-8",
            )}
            tabIndex={isOpen ? 0 : -1}
          />
          {query.length > 0 && (
            <div className="absolute right-1 flex items-center gap-1">
              {isRegex && (
                <span className="rounded bg-accent px-1 py-0.5 text-[10px] font-medium text-muted-foreground select-none">
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
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={handleClose}
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground hover:!bg-accent"
                    >
                      <IconX className="size-3.5" />
                    </Button>
                  }
                />
                <TooltipContent>Close search</TooltipContent>
              </Tooltip>
              {onAsk && (
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={isAsking || query.trim().length === 0}
                  onClick={() => onAsk(query.trim())}
                >
                  Ask
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
);

SearchBar.displayName = "SearchBar";
