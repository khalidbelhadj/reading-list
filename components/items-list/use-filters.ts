import React from "react";

import { useOpenTabItems } from "@/lib/open-tabs";
import { type DbTag, type Item } from "@/lib/types";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useSettings } from "@/lib/use-settings";

const parseActiveTagsMap = (raw: string): Record<string, string[]> => {
  const value = JSON.parse(raw);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string[]>;
  }
  return {};
};

export type GroupBy = "none" | "tag" | "day";
export type SortBy =
  "created-desc" | "created-asc" | "updated-desc" | "updated-asc";

const sortComparator = (sortBy: SortBy) => {
  switch (sortBy) {
    case "created-desc":
      return (a: Item, b: Item) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    case "created-asc":
      return (a: Item, b: Item) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    case "updated-desc":
      return (a: Item, b: Item) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    case "updated-asc":
      return (a: Item, b: Item) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
  }
};

export type ItemGroup = {
  key: string;
  label: string;
  items: Item[];
};

// Smart day-bucket label derived from an ISO timestamp. Recent items get
// natural-language labels; older items collapse to "Month YYYY" buckets.
const dayBucket = (
  iso: string,
  now: Date,
): { key: string; label: string; sortKey: number } => {
  const at = new Date(iso);
  const startOfDay = (d: Date) => {
    const startDate = new Date(d);
    startDate.setHours(0, 0, 0, 0);
    return startDate;
  };
  const today = startOfDay(now);
  const atDay = startOfDay(at);
  const diffDays = Math.round(
    (today.getTime() - atDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  // sortKey: newer = higher.
  if (diffDays === 0) return { key: "today", label: "Today", sortKey: 1e15 };
  if (diffDays === 1)
    return { key: "yesterday", label: "Yesterday", sortKey: 1e15 - 1 };
  if (diffDays < 7)
    return { key: "this-week", label: "This week", sortKey: 1e15 - 2 };
  if (
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth()
  ) {
    return { key: "this-month", label: "This month", sortKey: 1e15 - 3 };
  }
  const month = at.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  return {
    key: `month-${at.getFullYear()}-${at.getMonth()}`,
    label: month,
    sortKey: at.getFullYear() * 12 + at.getMonth(),
  };
};

const buildGroups = (
  items: Item[],
  groupBy: GroupBy,
  sortBy: SortBy,
): ItemGroup[] => {
  if (groupBy === "tag") {
    const byTag = new Map<string, Item[]>();
    const untagged: Item[] = [];
    for (const item of items) {
      if (item.tags.length === 0) {
        untagged.push(item);
        continue;
      }
      for (const tag of item.tags) {
        const existing = byTag.get(tag.name);
        if (existing) existing.push(item);
        else byTag.set(tag.name, [item]);
      }
    }
    const groups: ItemGroup[] = [...byTag.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, groupItems]) => ({
        key: `tag:${name}`,
        label: name,
        items: groupItems,
      }));
    if (untagged.length > 0) {
      groups.push({
        key: "tag:__untagged__",
        label: "Untagged",
        items: untagged,
      });
    }
    return groups;
  }

  if (groupBy === "day") {
    // Bucket by whichever date axis is being sorted on, so "Today" under
    // "Recently updated" means "updated today", not "added today".
    const axis: "createdAt" | "updatedAt" = sortBy.startsWith("updated")
      ? "updatedAt"
      : "createdAt";
    const ascending = sortBy.endsWith("-asc");
    const now = new Date();
    const buckets = new Map<
      string,
      { label: string; sortKey: number; items: Item[] }
    >();
    for (const item of items) {
      const bucket = dayBucket(item[axis], now);
      const existing = buckets.get(bucket.key);
      if (existing) existing.items.push(item);
      else
        buckets.set(bucket.key, {
          label: bucket.label,
          sortKey: bucket.sortKey,
          items: [item],
        });
    }
    return [...buckets.entries()]
      .sort(([, a], [, b]) =>
        ascending ? a.sortKey - b.sortKey : b.sortKey - a.sortKey,
      )
      .map(([key, value]) => ({
        key: `day:${key}`,
        label: value.label,
        // items inherit sortedItems' sortBy order already, no need to re-sort.
        items: value.items,
      }));
  }

  return [];
};

// Key under which active tag filters are persisted in localStorage. Retained as
// a stable string (rather than a tab id) so existing users' saved filters carry
// over now that the reading list is the only view.
const ACTIVE_TAGS_KEY = "reading-list";

export const useItemsFilters = (
  items: Item[] | undefined,
  searchOrder: string[] | null = null,
) => {
  // activeTagsMap is local-only state — stays in localStorage rather than the
  // server-backed settings blob.
  // Toolbar elements that reflect settings values wrap their mismatching
  // content in `<span suppressHydrationWarning>` to silence the structural
  // mismatch warning when SSR defaults differ from the stored value.
  const [activeTagsMap, setActiveTagsMap] = useLocalStorage<
    Record<string, string[]>
  >("activeTagsMap", {}, parseActiveTagsMap, JSON.stringify);
  const activeTags = React.useMemo(
    () => new Set(activeTagsMap[ACTIVE_TAGS_KEY] ?? []),
    [activeTagsMap],
  );
  const setActiveTags = React.useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      setActiveTagsMap((prev) => {
        const current = new Set(prev[ACTIVE_TAGS_KEY] ?? []);
        const next = updater(current);
        return { ...prev, [ACTIVE_TAGS_KEY]: [...next] };
      });
    },
    [setActiveTagsMap],
  );

  const { settings, setSetting } = useSettings();
  const { tagsOpen, showRead, groupBy, sortBy } = settings;
  const setTagsOpen = React.useCallback<
    React.Dispatch<React.SetStateAction<boolean>>
  >((next) => setSetting("tagsOpen", next), [setSetting]);
  const setShowRead = React.useCallback<
    React.Dispatch<React.SetStateAction<boolean>>
  >((next) => setSetting("showRead", next), [setSetting]);

  // Server hands us items in created-desc order; for any other sort, re-sort
  // client-side. Skip the work when the default matches the server order.
  const sortedItems = React.useMemo(() => {
    const base = items ?? [];
    if (sortBy === "created-desc") return base;
    return base.slice().sort(sortComparator(sortBy));
  }, [items, sortBy]);

  const allTags = React.useMemo(() => {
    const tagMap = new Map<string, DbTag>();
    for (const item of sortedItems) {
      for (const tag of item.tags) {
        tagMap.set(tag.name, tag);
      }
    }
    return Array.from(tagMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [sortedItems]);

  // Prune active tags that no longer exist in the current tab's items
  React.useEffect(() => {
    const validTagNames = new Set(allTags.map((t) => t.name));
    const stale = [...activeTags].filter((t) => !validTagNames.has(t));
    if (stale.length > 0) {
      setActiveTags((prev) => {
        const next = new Set(prev);
        for (const t of stale) next.delete(t);
        return next;
      });
    }
  }, [allTags, activeTags, setActiveTags]);

  const matchesTagFilter = React.useCallback(
    (item: Item) =>
      activeTags.size === 0 || item.tags.some((t) => activeTags.has(t.name)),
    [activeTags],
  );

  // When a search is active, render in the order returned by the search (local
  // matches first, server-only matches after). Otherwise preserve the natural
  // creation-date order from the cache.
  const filteredItems = React.useMemo(() => {
    const passesFilters = (item: Item) =>
      (showRead || !item.read) && matchesTagFilter(item);
    if (searchOrder !== null) {
      const byId = new Map(sortedItems.map((i) => [i.id, i]));
      const out: Item[] = [];
      for (const id of searchOrder) {
        const item = byId.get(id);
        if (item && passesFilters(item)) out.push(item);
      }
      return out;
    }
    return sortedItems.filter(passesFilters);
  }, [sortedItems, showRead, matchesTagFilter, searchOrder]);

  // Read items suppressed by the "hide read" toggle that would otherwise pass
  // the current search + tag filters — drives the "N read items not shown"
  // empty state in the list.
  const hiddenReadCount = React.useMemo(() => {
    if (showRead) return 0;
    const searchSet = searchOrder !== null ? new Set(searchOrder) : null;
    return sortedItems.filter(
      (item) =>
        item.read &&
        (searchSet === null || searchSet.has(item.id)) &&
        matchesTagFilter(item),
    ).length;
  }, [showRead, sortedItems, searchOrder, matchesTagFilter]);

  const toggleTag = React.useCallback(
    (tagName: string) => {
      setActiveTags((prev) => {
        const next = new Set(prev);
        if (next.has(tagName)) {
          next.delete(tagName);
        } else {
          next.add(tagName);
        }
        return next;
      });
    },
    [setActiveTags],
  );

  // Items that are also open in a local browser tab right now (desktop only).
  // They get their own section above Pinned and are excluded from the other
  // two: one row per item, so the keyboard-nav registry never sees the same id
  // twice. Empty on web, while searching, and when the setting is off — which
  // also stops the main process from polling at all.
  const openTabMatches = useOpenTabItems(filteredItems);
  const openTabItems = React.useMemo(
    () => (searchOrder !== null ? [] : openTabMatches),
    [openTabMatches, searchOrder],
  );
  const openTabIds = React.useMemo(
    () => new Set(openTabItems.map((item) => item.id)),
    [openTabItems],
  );

  // While searching, the results are already ordered (local-first, then
  // server-only) — collapse pinned/grouped into the flat filtered list so the
  // render path stays a single ordered column.
  const pinnedItems = React.useMemo(
    () =>
      searchOrder !== null
        ? []
        : filteredItems.filter(
            (item) => item.starred && !openTabIds.has(item.id),
          ),
    [filteredItems, searchOrder, openTabIds],
  );

  const unpinnedItems = React.useMemo(
    () =>
      searchOrder !== null
        ? filteredItems
        : filteredItems.filter(
            (item) => !item.starred && !openTabIds.has(item.id),
          ),
    [filteredItems, searchOrder, openTabIds],
  );

  const groups = React.useMemo(
    () =>
      searchOrder !== null ? [] : buildGroups(unpinnedItems, groupBy, sortBy),
    [unpinnedItems, groupBy, sortBy, searchOrder],
  );

  return {
    sortedItems,
    allTags,
    filteredItems,
    hiddenReadCount,
    openTabItems,
    pinnedItems,
    unpinnedItems,
    activeTags,
    setActiveTags,
    toggleTag,
    tagsOpen,
    setTagsOpen,
    showRead,
    setShowRead,
    groupBy,
    sortBy,
    groups,
  };
};
