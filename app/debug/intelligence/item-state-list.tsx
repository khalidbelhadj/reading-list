// The item list: state, title, and — when something went wrong — the reason,
// in the row, in words.
//
// Four filters and a text box, in place of a faceted sidebar over seven
// columns. The facets existed because the interesting state was scattered;
// with one state column there is one thing to filter on.
import { IconRefresh } from "@tabler/icons-react";
import React from "react";

import type { ContentOverviewRow } from "@/app/actions";
import { Favicon } from "@/components/items-list/favicon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NonIdealState } from "@/components/ui/non-ideal-state";
import { describeFailure } from "@/lib/extract/failure";
import { cn } from "@/lib/utils";

export type StateFilter = "all" | "working" | "failed" | "ready";

const FILTERS: { value: StateFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "working", label: "Working" },
  { value: "failed", label: "Failed" },
  { value: "ready", label: "Indexed" },
];

const STATE_DOT: Record<string, string> = {
  ready: "bg-primary",
  running: "bg-primary/60 animate-pulse",
  pending: "bg-muted-foreground/40",
  failed: "bg-destructive",
};

const matchesFilter = (
  row: ContentOverviewRow,
  filter: StateFilter,
): boolean => {
  if (filter === "all") return true;
  if (filter === "failed") return row.state === "failed";
  if (filter === "ready") return row.state === "ready";
  return row.state === "pending" || row.state === "running";
};

export const ItemStateList = ({
  rows,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  matchedIds,
  openItemId,
  onOpen,
  onReindex,
}: {
  rows: ContentOverviewRow[];
  filter: StateFilter;
  onFilterChange: (filter: StateFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  // Non-null when a semantic search is active: restricts the list to its hits.
  matchedIds: Set<string> | null;
  openItemId: string | null;
  onOpen: (itemId: string) => void;
  onReindex: (itemId: string) => void;
}) => {
  const needle = query.trim().toLowerCase();
  const visible = React.useMemo(
    () =>
      rows.filter((row) => {
        if (matchedIds && !matchedIds.has(row.itemId)) return false;
        if (!matchesFilter(row, filter)) return false;
        if (!needle) return true;
        return (
          row.itemTitle.toLowerCase().includes(needle) ||
          row.url.toLowerCase().includes(needle)
        );
      }),
    [rows, filter, needle, matchedIds],
  );

  const handleQueryChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      onQueryChange(event.target.value),
    [onQueryChange],
  );

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {FILTERS.map((entry) => (
            <Button
              key={entry.value}
              variant={filter === entry.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onFilterChange(entry.value)}
            >
              {entry.label}
            </Button>
          ))}
        </div>
        <Input
          value={query}
          onChange={handleQueryChange}
          placeholder="Filter by title or URL…"
          className="max-w-72"
        />
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {visible.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <NonIdealState
          align="center"
          size="sm"
          className="py-10"
          title="Nothing here"
          description="No item matches this filter."
        />
      ) : (
        <div className="flex flex-col">
          {visible.map((row) => {
            const failure =
              row.state === "failed"
                ? describeFailure(row.failureReason)
                : null;
            return (
              <div
                key={row.itemId}
                role="presentation"
                onClick={() => onOpen(row.itemId)}
                className={cn(
                  "group flex cursor-default items-center gap-3 rounded-md px-2 py-1.5",
                  openItemId === row.itemId ? "bg-muted" : "hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    STATE_DOT[row.state] ?? "bg-muted-foreground/40",
                  )}
                />
                <Favicon
                  item={{ url: row.url, faviconUrl: null }}
                  className="shrink-0"
                />
                <span className="min-w-0 flex-1 truncate font-content text-sm">
                  {row.itemTitle || row.url}
                </span>
                {failure && (
                  <span className="shrink-0 text-xs text-destructive">
                    {failure.label}
                  </span>
                )}
                {row.state === "ready" && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {row.chunkCount} chunks
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Re-index"
                  className="shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    onReindex(row.itemId);
                  }}
                >
                  <IconRefresh />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
