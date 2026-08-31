import { IconSearch, IconStarFilled } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { fetchItems } from "@/app/actions";
import {
  type ListDensity,
  type ListGroupBy,
  type ListSortBy,
  ListViewOptions,
} from "@/components/app/list-view-options";
import { Badge } from "@/components/system/badge";
import { Button } from "@/components/system/button";
import { Input } from "@/components/system/input";
import { Skeleton } from "@/components/system/skeleton";
import { Spinner } from "@/components/system/spinner";
import { groupByDate } from "@/lib/date-groups";
import { timeAgo } from "@/lib/format-time";
import { useOpenTabItems } from "@/lib/open-tabs";
import { type Item } from "@/lib/types";
import { useSettings } from "@/lib/use-settings";

import { AskResults } from "./ask-results";
import { ItemRow } from "./item-row";
import { useAsk } from "./use-ask";
import { useItemSearch } from "./use-search";

const LoadingRows = ({ count }: { count: number }) => (
  <div className="flex flex-col gap-0.5">
    {Array.from({ length: count }, (_, index) => (
      <Skeleton key={index} className="h-row w-full" />
    ))}
  </div>
);

// All items: a search bar, then every item grouped by the date it was added.
// Typing filters in two passes — instantly against the cached titles/urls,
// with a server trigram pass over notes settling underneath (loading rows
// appended below the instant hits). The Ask button (or Alt+Enter) hands the
// query to the agentic search instead, whose activity feed replaces the list.
export const AllItems = ({ onOpen }: { onOpen: (id: string) => void }) => {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  const [query, setQuery] = React.useState("");
  const search = useItemSearch(query, items);
  const ask = useAsk();
  const { clearAsk } = ask;

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
      // Editing the query drops back into filter mode; Ask re-runs on demand.
      clearAsk();
    },
    [clearAsk],
  );

  const handleAsk = React.useCallback(() => {
    ask.runAsk(query);
  }, [ask, query]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && event.altKey && query.trim().length > 0) {
        event.preventDefault();
        handleAsk();
      }
    },
    [handleAsk, query],
  );

  const itemsById = React.useMemo(() => {
    const map = new Map<string, Item>();
    for (const item of items ?? []) map.set(item.id, item);
    return map;
  }, [items]);

  const searchResults = React.useMemo(
    () =>
      (search.order ?? [])
        .map((id) => itemsById.get(id))
        .filter((item): item is Item => item !== undefined),
    [search.order, itemsById],
  );

  // View options live in user settings: the browse list respects them; search
  // and Ask always cover everything (a query is explicit intent). The stored
  // density keeps its historical name ("cozy" is what the UI calls "preview").
  const { settings, setSetting } = useSettings();
  const groupBy: ListGroupBy = settings.groupBy;
  const sortBy: ListSortBy = settings.sortBy;
  const density: ListDensity =
    settings.density === "compact" ? "compact" : "preview";
  const now = React.useMemo(() => new Date(), []);
  const nowIso = React.useMemo(() => now.toISOString(), [now]);

  // Starred items get their own section above the browse list (mirroring the
  // sidebar), so the date groups exclude them.
  const starred = React.useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.starred && (settings.showRead || !item.read))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [items, settings.showRead],
  );

  const browseItems = React.useMemo(() => {
    const sortKey = sortBy.startsWith("updated") ? "updatedAt" : "createdAt";
    const direction = sortBy.endsWith("asc") ? 1 : -1;
    return (items ?? [])
      .filter((item) => !item.starred && (settings.showRead || !item.read))
      .sort((a, b) => direction * a[sortKey].localeCompare(b[sortKey]));
  }, [items, settings.showRead, sortBy]);

  const groups = React.useMemo(
    () =>
      groupBy === "day"
        ? groupByDate(browseItems, (item) => item.createdAt, now)
        : null,
    [browseItems, groupBy, now],
  );
  // Items open in a browser tab right now (desktop only): their own section
  // above the browse list, regardless of read state — they're open.
  const openInBrowser = useOpenTabItems(items);

  const renderRow = React.useCallback(
    (item: Item, showStar = true) => (
      <ItemRow
        item={item}
        showStar={showStar}
        onOpen={onOpen}
        variant={density}
        meta={
          density === "preview"
            ? `Added ${timeAgo(item.createdAt, nowIso)}`
            : undefined
        }
      />
    ),
    [onOpen, density, nowIso],
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-8 pt-12 pb-16">
      <Input
        leading={<IconSearch />}
        trailing={trailing}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search"
        aria-label="Search items"
        autoFocus
      />

      {!ask.askActive && !search.active && (
        <ListViewOptions
          className="-my-3"
          showRead={settings.showRead}
          onShowReadChange={(showRead) => setSetting("showRead", showRead)}
          groupBy={groupBy}
          onGroupByChange={(next) => setSetting("groupBy", next)}
          sortBy={sortBy}
          onSortByChange={(next) => setSetting("sortBy", next)}
          density={density}
          onDensityChange={(next) =>
            setSetting("density", next === "preview" ? "cozy" : "compact")
          }
        />
      )}

      {ask.askActive ? (
        <AskResults
          steps={ask.steps}
          summary={ask.summary}
          resultIds={ask.resultIds}
          isAsking={ask.isAsking}
          hasPresented={ask.hasPresented}
          error={ask.error}
          items={items ?? []}
          onOpen={onOpen}
        />
      ) : search.active ? (
        <div className="flex flex-col gap-0.5">
          {searchResults.map((item) => (
            <ItemRow key={item.id} item={item} onOpen={onOpen} />
          ))}
          {/* The server pass is still settling — show that more may come. */}
          {(search.pending || search.serverPending) && (
            <LoadingRows count={3} />
          )}
          {!search.serverPending && searchResults.length === 0 && (
            <p className="py-4 text-center text-small text-muted-foreground">
              No matching items.
            </p>
          )}
        </div>
      ) : items ? (
        <BrowseList
          openInBrowser={openInBrowser}
          starred={starred}
          groups={groups}
          browseItems={browseItems}
          renderRow={renderRow}
        />
      ) : (
        <LoadingRows count={8} />
      )}
    </div>
  );
};

// The browse view: the open-in-browser and starred sections (when any), then
// the date groups or the flat sorted list.
const BrowseList = ({
  openInBrowser,
  starred,
  groups,
  browseItems,
  renderRow,
}: {
  openInBrowser: Item[];
  starred: Item[];
  groups: ReturnType<typeof groupByDate<Item>> | null;
  browseItems: Item[];
  renderRow: (item: Item, showStar?: boolean) => React.ReactNode;
}) => (
  <>
    {openInBrowser.length > 0 && (
      <section className="flex flex-col gap-1">
        <h2 className="px-2 text-micro font-medium text-muted-foreground">
          Open in browser
        </h2>
        <ul className="flex flex-col gap-0.5">
          {openInBrowser.map((item) => (
            <li key={item.id}>{renderRow(item)}</li>
          ))}
        </ul>
      </section>
    )}
    {starred.length > 0 && (
      <section className="flex flex-col gap-1">
        <h2 className="flex items-center gap-1.5 px-2 text-micro font-medium text-muted-foreground">
          <IconStarFilled className="size-2.5 text-starred" />
          Starred
        </h2>
        <ul className="flex flex-col gap-0.5">
          {starred.map((item) => (
            <li key={item.id}>{renderRow(item, false)}</li>
          ))}
        </ul>
      </section>
    )}
    {groups ? (
      <div className="flex flex-col gap-3">
        {groups.map(({ group, entries }) => (
          <section key={group.key} className="flex flex-col gap-1">
            <h2 className="px-2 text-micro font-medium text-muted-foreground">
              {group.label}
            </h2>
            <ul className="flex flex-col gap-0.5">
              {entries.map((item) => (
                <li key={item.id}>{renderRow(item)}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    ) : (
      <ul className="flex flex-col gap-0.5">
        {browseItems.map((item) => (
          <li key={item.id}>{renderRow(item)}</li>
        ))}
      </ul>
    )}
  </>
);
