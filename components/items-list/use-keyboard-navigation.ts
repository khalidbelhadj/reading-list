import React from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  fetchPageTitle,
  createItem,
  deleteItem,
  reorderItem,
} from "@/app/actions";
import { type Item } from "@/lib/types";

export function useKeyboardNavigation({
  filteredItems,
  selectedIds,
  setSelectedIds,
  editingId,
  setEditingId,
  searchOpen,
  setSearch,
  setSearchOpen,
  searchInputRef,
  setActiveTabAndUrl,
  setHelpOpen,
  setTagsOpen,
  setShowRead,
  tabType,
  tabItems,
  cursorRef,
  setCursor,
}: {
  filteredItems: Item[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  editingId: string | null;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  searchOpen: boolean;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  setActiveTabAndUrl: (tab: string) => void;
  setHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTagsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRead: React.Dispatch<React.SetStateAction<boolean>>;
  tabType: string;
  tabItems: Item[];
  cursorRef: React.RefObject<string | null>;
  setCursor: (id: string | null) => void;
}) {
  const [suppressHover, setSuppressHover] = React.useState(false);
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["items"] });
  }

  // Cmd+V to quick-add a URL
  React.useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;
      try {
        const url = new URL(text);
        if (url.protocol === "http:" || url.protocol === "https:") {
          e.preventDefault();
          const domain = url.hostname.replace(/^www\./, "");
          createItem(domain, text, [], undefined, tabType).then(() => {
            invalidate();
            // Fetch title in background and update
            fetchPageTitle(text).then(() => invalidate());
          });
        }
      } catch {
        // not a valid URL, ignore
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [tabType, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global keyboard shortcuts: /, 1, 2, ?, a, t, r, Escape
  React.useEffect(() => {
    function handleGlobal(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      // Escape priority chain: editing → search → detail panel focus → selection
      if (e.key === "Escape") {
        if (editingId) {
          setEditingId(null);
        } else if (searchOpen) {
          setSearch("");
          setSearchOpen(false);
        } else {
          const panel = document.querySelector("[data-detail-panel]");
          if (panel?.contains(e.target as Node)) {
            (e.target as HTMLElement)?.blur?.();
          } else {
            setSelectedIds(new Set());
            setCursor(null);
          }
        }
        return;
      }
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
      if (e.key === "1" && !e.metaKey && !e.ctrlKey) {
        setActiveTabAndUrl("reading-list");
      }
      if (e.key === "2" && !e.metaKey && !e.ctrlKey) {
        setActiveTabAndUrl("bookmarks");
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setHelpOpen(true);
      }
      if (e.key === "a" && !e.metaKey && !e.ctrlKey && !editingId) {
        e.preventDefault();
        setEditingId("new");
      }
      if (e.key === "t" && !e.metaKey && !e.ctrlKey && !editingId) {
        e.preventDefault();
        setTagsOpen((v) => !v);
      }
      if (e.key === "r" && !e.metaKey && !e.ctrlKey && !editingId) {
        e.preventDefault();
        setShowRead((v) => !v);
      }
    }
    document.addEventListener("keydown", handleGlobal);
    return () => document.removeEventListener("keydown", handleGlobal);
  }, [editingId, searchOpen, setEditingId, setSearch, setSearchOpen, setSelectedIds, searchInputRef, setActiveTabAndUrl, setHelpOpen, setTagsOpen, setShowRead, cursorRef, setCursor]);

  // Cmd+Backspace to delete selected item
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === "Backspace" && (e.metaKey || e.ctrlKey) && selectedIds.size === 1 && !editingId) {
        e.preventDefault();
        const [id] = selectedIds;
        setSelectedIds(new Set());
        deleteItem(id).then(() => invalidate());
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, editingId, setSelectedIds, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+N/P navigation, Alt+Ctrl+N/P to reorder
  React.useEffect(() => {
    function scrollWithMargin(id: string) {
      const el = document.querySelector(`[data-item-id="${id}"]`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const rowHeight = rect.height;
      const margin = rowHeight * 3;
      const viewTop = 0;
      const viewBottom = window.innerHeight;
      if (rect.top - margin < viewTop) {
        window.scrollBy({ top: rect.top - margin - viewTop });
      } else if (rect.bottom + margin > viewBottom) {
        window.scrollBy({ top: rect.bottom + margin - viewBottom });
      }
    }

    function handleNav(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (editingId) return;

      const ids = filteredItems.map((i) => i.id);
      const currentCursor = cursorRef.current;
      const cursorIdx = currentCursor ? ids.indexOf(currentCursor) : -1;

      // Alt+Ctrl+N / Alt+Ctrl+P — move item up/down
      const isMoveDown = e.altKey && e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === "KeyN";
      const isMoveUp = e.altKey && e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === "KeyP";
      if (isMoveDown || isMoveUp) {
        e.preventDefault();
        if (selectedIds.size !== 1) return;
        const [selectedId] = selectedIds;
        const sortedItems = [...tabItems].sort((a, b) => a.position - b.position);
        const currentIndex = sortedItems.findIndex((i) => i.id === selectedId);
        if (currentIndex === -1) return;
        const newIndex = isMoveDown
          ? Math.min(currentIndex + 1, sortedItems.length - 1)
          : Math.max(currentIndex - 1, 0);
        if (newIndex === currentIndex) return;
        reorderItem(selectedId, tabType, newIndex).then(() => invalidate());
        return;
      }

      // Ctrl+N / Ctrl+P — navigation
      const isDown = e.code === "KeyN" && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      const isUp = e.code === "KeyP" && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      if (isDown || isUp) {
        e.preventDefault();
        if (ids.length === 0) return;

        let nextId: string;
        if (cursorIdx === -1) {
          nextId = isDown ? ids[0] : ids[ids.length - 1];
        } else {
          nextId = isDown
            ? ids[Math.min(cursorIdx + 1, ids.length - 1)]
            : ids[Math.max(cursorIdx - 1, 0)];
        }

        setCursor(nextId);
        setSuppressHover(true);
        scrollWithMargin(nextId);
        setSelectedIds(new Set([nextId]));
        return;
      }

      // Enter to focus detail panel title
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && selectedIds.size === 1) {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>("[data-detail-title]");
        if (el) {
          el.focus();
        } else {
          const [id] = selectedIds;
          setEditingId(id);
        }
        return;
      }

      // Cmd+Enter to open in new tab
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && selectedIds.size >= 1) {
        e.preventDefault();
        for (const id of selectedIds) {
          const item = filteredItems.find((i) => i.id === id);
          if (item) window.open(item.url, "_blank");
        }
        return;
      }
    }
    document.addEventListener("keydown", handleNav);
    return () => document.removeEventListener("keydown", handleNav);
  }, [selectedIds, editingId, filteredItems, tabType, tabItems, setSelectedIds, setEditingId, setSuppressHover, cursorRef, setCursor, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    suppressHover,
    setSuppressHover,
  };
}
