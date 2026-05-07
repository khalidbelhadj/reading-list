import React from "react";

import { type Item, type DbTag } from "@/lib/types";

export type TabId = "reading-list" | "cards";
export type GroupBy = "none" | "tag" | "day";

export type ItemGroup = {
  key: string;
  label: string;
  items: Item[];
};

// Smart day-bucket label derived from an ISO timestamp. Recent items get
// natural-language labels; older items collapse to "Month YYYY" buckets.
const dayBucket = (createdAtIso: string, now: Date): { key: string; label: string; sortKey: number } => {
  const created = new Date(createdAtIso);
  const startOfDay = (d: Date) => {
    const startDate = new Date(d);
    startDate.setHours(0, 0, 0, 0);
    return startDate;
  };
  const today = startOfDay(now);
  const createdDay = startOfDay(created);
  const diffDays = Math.round(
    (today.getTime() - createdDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Use createdDay timestamp for sort priority — newer = higher.
  if (diffDays === 0) return { key: "today", label: "Today", sortKey: 1e15 };
  if (diffDays === 1) return { key: "yesterday", label: "Yesterday", sortKey: 1e15 - 1 };
  if (diffDays < 7) return { key: "this-week", label: "This week", sortKey: 1e15 - 2 };
  if (
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth()
  ) {
    return { key: "this-month", label: "This month", sortKey: 1e15 - 3 };
  }
  const month = created.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  return {
    key: `month-${created.getFullYear()}-${created.getMonth()}`,
    label: month,
    sortKey: created.getFullYear() * 12 + created.getMonth(),
  };
};

const buildGroups = (items: Item[], groupBy: GroupBy): ItemGroup[] => {
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
      groups.push({ key: "tag:__untagged__", label: "Untagged", items: untagged });
    }
    return groups;
  }

  if (groupBy === "day") {
    const now = new Date();
    const buckets = new Map<string, { label: string; sortKey: number; items: Item[] }>();
    for (const item of items) {
      const bucket = dayBucket(item.createdAt, now);
      const existing = buckets.get(bucket.key);
      if (existing) existing.items.push(item);
      else buckets.set(bucket.key, { label: bucket.label, sortKey: bucket.sortKey, items: [item] });
    }
    return [...buckets.entries()]
      .sort(([, a], [, b]) => b.sortKey - a.sortKey)
      .map(([key, value]) => ({
        key: `day:${key}`,
        label: value.label,
        items: value.items
          .slice()
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
      }));
  }

  return [];
};

export const useItemsFilters = (items: Item[] | undefined, activeTab: TabId, searchIds: Set<string> | null = null) => {
  const [activeTagsMap, setActiveTagsMap] = React.useState<Record<string, string[]>>({});
  const activeTags = React.useMemo(() => new Set(activeTagsMap[activeTab] ?? []), [activeTagsMap, activeTab]);
  const setActiveTags = React.useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setActiveTagsMap((prev) => {
      const current = new Set(prev[activeTab] ?? []);
      const next = updater(current);
      return { ...prev, [activeTab]: [...next] };
    });
  }, [activeTab]);

  // Read preferences synchronously on first client render so filters apply
  // from frame 1. On the server `window` is undefined and we use defaults;
  // the toolbar elements that reflect these values wrap their mismatching
  // content in `<span suppressHydrationWarning>` to silence the structural
  // mismatch warning.
  const [tagsOpen, setTagsOpen] = React.useState(() =>
    typeof window === "undefined"
      ? false
      : localStorage.getItem("tagsOpen") === "true",
  );
  const [showRead, setShowRead] = React.useState(() =>
    typeof window === "undefined"
      ? false
      : localStorage.getItem("showRead") === "true",
  );
  const [groupBy, setGroupBy] = React.useState<GroupBy>(() => {
    if (typeof window === "undefined") return "none";
    const stored = localStorage.getItem("groupBy");
    return stored === "tag" || stored === "day" ? stored : "none";
  });
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("activeTagsMap");
      if (stored) setActiveTagsMap(JSON.parse(stored));
    } catch {}
  }, []);

  React.useEffect(() => {
    localStorage.setItem("activeTagsMap", JSON.stringify(activeTagsMap));
  }, [activeTagsMap]);
  React.useEffect(() => {
    localStorage.setItem("tagsOpen", String(tagsOpen));
  }, [tagsOpen]);
  React.useEffect(() => {
    localStorage.setItem("showRead", String(showRead));
  }, [showRead]);
  React.useEffect(() => {
    localStorage.setItem("groupBy", groupBy);
  }, [groupBy]);

  const tabItems = React.useMemo(
    () =>
      (items ?? [])
        .sort((a, b) => a.position - b.position),
    [items],
  );

  const allTags = React.useMemo(() => {
    const tagMap = new Map<string, DbTag>();
    for (const item of tabItems) {
      for (const tag of item.tags) {
        tagMap.set(tag.name, tag);
      }
    }
    return Array.from(tagMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [tabItems]);

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

  const filteredItems = React.useMemo(
    () =>
      tabItems.filter((item) => {
        if (searchIds !== null && !searchIds.has(item.id)) return false;
        if (!showRead && item.read) return false;
        if (activeTags.size > 0 && !item.tags.some((t) => activeTags.has(t.name))) return false;
        return true;
      }),
    [tabItems, showRead, activeTags, searchIds],
  );

  const toggleTag = React.useCallback((tagName: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) {
        next.delete(tagName);
      } else {
        next.add(tagName);
      }
      return next;
    });
  }, [setActiveTags]);

  const groups = React.useMemo(
    () => buildGroups(filteredItems, groupBy),
    [filteredItems, groupBy],
  );

  return {
    tabItems,
    allTags,
    filteredItems,
    activeTags,
    setActiveTags,
    toggleTag,
    tagsOpen,
    setTagsOpen,
    showRead,
    setShowRead,
    groupBy,
    setGroupBy,
    groups,
  };
};
