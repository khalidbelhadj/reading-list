import { useQuery } from "@tanstack/react-query";
import React from "react";

import { fetchItems } from "@/app/actions";
import { Badge } from "@/components/system/badge";
import { Button } from "@/components/system/button";
import { CommandPalette } from "@/components/system/command-palette";
import { Skeleton } from "@/components/system/skeleton";
import { Spinner } from "@/components/system/spinner";
import { type Item } from "@/lib/types";

import { AskResults } from "./ask-results";
import { ItemRow } from "./item-row";
import { useAsk } from "./use-ask";
import { useItemSearch } from "./use-search";

const RECENT_COUNT = 5;
const MAX_RESULTS = 50;

// ⌘K: jump to an item, with the Reading list's full search stack. Empty
// query shows the five most recent; typing runs the two-pass search (instant
// local hits, the server trigram pass deepening beneath — loading rows show
// while it settles); the Ask button or Alt+Enter hands the query to the
// agentic search, whose feed takes over the sheet. Arrows or Ctrl+N/P move,
// Enter opens, Escape closes.
export const ItemPalette = ({
  open,
  onOpenChange,
  onOpen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: (id: string) => void;
}) => {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });
  const [query, setQuery] = React.useState("");
  const search = useItemSearch(query, items);
  const ask = useAsk();
  const { clearAsk, runAsk } = ask;

  const handleQueryChange = React.useCallback(
    (next: string) => {
      setQuery(next);
      // Editing the query drops back into filter mode; Ask re-runs on demand.
      clearAsk();
    },
    [clearAsk],
  );

  const itemsById = React.useMemo(() => {
    const map = new Map<string, Item>();
    for (const item of items ?? []) map.set(item.id, item);
    return map;
  }, [items]);

  const entries = React.useMemo(() => {
    if (!search.active) {
      return (items ?? [])
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, RECENT_COUNT);
    }
    return (search.order ?? [])
      .map((id) => itemsById.get(id))
      .filter((item): item is Item => item !== undefined)
      .slice(0, MAX_RESULTS);
  }, [items, search.active, search.order, itemsById]);

  const handleAsk = React.useCallback(() => {
    if (query.trim().length > 0) runAsk(query);
  }, [runAsk, query]);

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && event.altKey) {
        event.preventDefault();
        handleAsk();
        return true;
      }
    },
    [handleAsk],
  );

  const pickAndClose = React.useCallback(
    (id: string) => {
      onOpen(id);
      onOpenChange(false);
    },
    [onOpen, onOpenChange],
  );

  const trailing = query.trim().length > 0 && (
    <span className="flex items-center gap-1.5">
      {search.isRegex && <Badge>regex</Badge>}
      {search.resultCount !== null ? (
        <span className="text-micro text-muted-foreground tabular-nums">
          {search.resultCount}
        </span>
      ) : (
        <Spinner className="size-3" />
      )}
      <Button
        variant="ghost"
        size="sm"
        className="-mr-1.5 px-1.5"
        disabled={ask.isAsking}
        onClick={handleAsk}
      >
        Ask
      </Button>
    </span>
  );

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      query={query}
      onQueryChange={handleQueryChange}
      entries={entries}
      getKey={(item) => item.id}
      onPick={(item) => onOpen(item.id)}
      placeholder="Search items"
      header={search.active ? undefined : "Recent"}
      trailing={trailing || undefined}
      onInputKeyDown={handleInputKeyDown}
      // The server pass is still settling — show that more may come, and
      // hold the empty state until it lands.
      footer={
        search.active &&
        (search.pending || search.serverPending) && (
          <div className="flex flex-col gap-0.5">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-row w-full" />
            ))}
          </div>
        )
      }
      emptyText={
        search.active && search.serverPending ? null : "No matching items."
      }
      body={
        ask.askActive ? (
          <AskResults
            steps={ask.steps}
            summary={ask.summary}
            resultIds={ask.resultIds}
            isAsking={ask.isAsking}
            hasPresented={ask.hasPresented}
            error={ask.error}
            items={items ?? []}
            onOpen={pickAndClose}
          />
        ) : undefined
      }
      renderEntry={(item, selected) => (
        // The one shared item row, star and context menu included; the
        // palette's wrapper handles the pick, so the row's own onOpen is
        // redundant (the view change dedupes).
        <ItemRow item={item} selected={selected} onOpen={onOpen} />
      )}
    />
  );
};
