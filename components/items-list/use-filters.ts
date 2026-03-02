import React from "react";

import { type Item, type DbTag, isReadingListItem } from "@/lib/types";

export function useItemsFilters(items: Item[] | undefined, activeTab: string) {
  const [activeTagsMap, setActiveTagsMap] = React.useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("activeTagsMap") ?? "{}"); } catch { return {}; }
  });
  const activeTags = React.useMemo(() => new Set(activeTagsMap[activeTab] ?? []), [activeTagsMap, activeTab]);
  const setActiveTags = React.useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setActiveTagsMap((prev) => {
      const current = new Set(prev[activeTab] ?? []);
      const next = updater(current);
      return { ...prev, [activeTab]: [...next] };
    });
  }, [activeTab]);

  const [tagsOpen, setTagsOpen] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("tagsOpen") === "true";
  });
  const [showRead, setShowRead] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("showRead") === "true";
  });
  const [search, setSearch] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => { localStorage.setItem("activeTagsMap", JSON.stringify(activeTagsMap)); }, [activeTagsMap]);
  React.useEffect(() => { localStorage.setItem("tagsOpen", String(tagsOpen)); }, [tagsOpen]);
  React.useEffect(() => { localStorage.setItem("showRead", String(showRead)); }, [showRead]);

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
