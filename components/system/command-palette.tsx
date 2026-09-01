import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { IconSearch } from "@tabler/icons-react";
import React from "react";

import { Input } from "./input";

/**
 * A ⌘K-style palette: a frost sheet near the top of the screen with a search
 * input and a keyboard-navigable list. The palette owns the selection —
 * arrows or Ctrl+N/P move it, Enter picks, Escape closes, pointer hover
 * follows — and the caller owns the query and what the entries are:
 * `entries` is whatever the current query should show, `renderEntry` draws a
 * row (the `selected` flag styles it), `onPick` fires on Enter or click.
 */
export const CommandPalette = <T,>({
  open,
  onOpenChange,
  query,
  onQueryChange,
  entries,
  getKey,
  renderEntry,
  onPick,
  placeholder = "Search",
  header,
  emptyText = "No matches.",
  trailing,
  footer,
  body,
  onInputKeyDown,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  entries: T[];
  getKey: (entry: T) => string;
  renderEntry: (entry: T, selected: boolean) => React.ReactNode;
  onPick: (entry: T) => void;
  placeholder?: string;
  // Shown above the list (e.g. "Recent" while the query is empty).
  header?: React.ReactNode;
  emptyText?: React.ReactNode;
  // Inside the input, on the right (a result count, an action button).
  trailing?: React.ReactNode;
  // Below the entries inside the scroll area (loading rows while a deeper
  // pass settles).
  footer?: React.ReactNode;
  // Replaces the whole list (e.g. an activity feed); entry navigation is
  // inert while present.
  body?: React.ReactNode;
  // Runs before the palette's own key handling; return true to consume the
  // event (e.g. Alt+Enter handing the query elsewhere).
  onInputKeyDown?: (event: React.KeyboardEvent) => boolean | void;
}) => {
  const [index, setIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  // A fresh palette every time it opens. The callback rides in a ref so an
  // unstable caller identity doesn't re-clear an open palette.
  const onQueryChangeRef = React.useRef(onQueryChange);
  React.useEffect(() => {
    onQueryChangeRef.current = onQueryChange;
  });
  React.useEffect(() => {
    if (open) {
      onQueryChangeRef.current("");
      setIndex(0);
    }
  }, [open]);

  const selected = Math.min(index, Math.max(0, entries.length - 1));

  // Keep the selected row in view as the selection moves.
  React.useEffect(() => {
    listRef.current
      ?.querySelector(`[data-palette-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const pick = React.useCallback(
    (entry: T) => {
      onPick(entry);
      onOpenChange(false);
    },
    [onPick, onOpenChange],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (onInputKeyDown?.(event) === true) return;
      if (body) return;
      const isNext =
        event.key === "ArrowDown" ||
        (event.ctrlKey && !event.metaKey && event.code === "KeyN");
      const isPrev =
        event.key === "ArrowUp" ||
        (event.ctrlKey && !event.metaKey && event.code === "KeyP");
      if (isNext || isPrev) {
        event.preventDefault();
        if (entries.length === 0) return;
        setIndex(
          (current) =>
            (Math.min(current, entries.length - 1) +
              (isNext ? 1 : entries.length - 1)) %
            entries.length,
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const entry = entries[selected];
        if (entry) pick(entry);
      }
    },
    [entries, selected, pick, body, onInputKeyDown],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50" />
        <DialogPrimitive.Popup
          data-slot="command-palette"
          className="glass fixed top-24 left-1/2 z-50 flex w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 rounded-surface p-2 transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0"
        >
          <Input
            autoFocus
            leading={<IconSearch />}
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={placeholder}
            trailing={trailing}
          />
          <div
            ref={listRef}
            className="flex max-h-96 flex-col gap-0.5 overflow-y-auto"
          >
            {body ?? (
              <>
                {header && entries.length > 0 && (
                  <p className="px-2 pt-1 text-micro font-medium text-muted-foreground select-none">
                    {header}
                  </p>
                )}
                {entries.map((entry, entryIndex) => (
                  <div
                    key={getKey(entry)}
                    data-palette-index={entryIndex}
                    onClick={() => pick(entry)}
                    onPointerEnter={() => setIndex(entryIndex)}
                  >
                    {renderEntry(entry, entryIndex === selected)}
                  </div>
                ))}
                {footer}
                {entries.length === 0 && emptyText != null && (
                  <p className="px-2 py-3 text-small text-muted-foreground select-none">
                    {emptyText}
                  </p>
                )}
              </>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
