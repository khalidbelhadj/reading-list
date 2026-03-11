import React from "react";

import { type Item, type DbTag, isReadingListItem } from "@/lib/types";

export function useItemsFilters(items: Item[] | undefined, activeTab: string) {
  const [activeTagsMap, setActiveTagsMap] = React.useState<Record<string, string[]>>({});
  const activeTags = React.useMemo(() => new Set(activeTagsMap[activeTab] ?? []), [activeTagsMap, activeTab]);
  const setActiveTags = React.useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setActiveTagsMap((prev) => {
      const current = new Set(prev[activeTab] ?? []);
      const next = updater(current);
      return { ...prev, [activeTab]: [...next] };
    });
  }, [activeTab]);

  const [tagsOpen, setTagsOpen] = React.useState(false);
  const [showRead, setShowRead] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("activeTagsMap");
      if (stored) setActiveTagsMap(JSON.parse(stored));
    } catch {}
    setTagsOpen(localStorage.getItem("tagsOpen") === "true");
    setShowRead(localStorage.getItem("showRead") === "true");
    setHydrated(true);
  }, []);

  React.useEffect(() => { if (hydrated) localStorage.setItem("activeTagsMap", JSON.stringify(activeTagsMap)); }, [activeTagsMap, hydrated]);
  React.useEffect(() => { if (hydrated) localStorage.setItem("tagsOpen", String(tagsOpen)); }, [tagsOpen, hydrated]);
  React.useEffect(() => { if (hydrated) localStorage.setItem("showRead", String(showRead)); }, [showRead, hydrated]);

  const tabType = activeTab === "bookmarks" ? "bookmark" : "reading-list";

  const tabItems = React.useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.type === tabType)
        .sort((a, b) => a.position - b.position),
    [items, tabType],
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

  const filteredItems = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    return tabItems.filter((item) => {
      if (isReadingListItem(item) && !showRead && item.read) {
        return false;
      }
      if (
        q &&
        !item.title.toLowerCase().includes(q) &&
        !item.url.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (
        activeTags.size > 0 &&
        !item.tags.some((t) => activeTags.has(t.name))
      ) {
        return false;
      }
      return true;
    });
  }, [tabItems, showRead, search, activeTags]);

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

  return {
    tabType,
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
    search,
    setSearch,
    searchOpen,
    setSearchOpen,
  };
}
