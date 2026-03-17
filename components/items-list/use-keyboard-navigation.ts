import React from "react";

import { fetchPageTitle } from "@/app/actions";
import { useStore } from "@/lib/store";
import { type Item } from "@/lib/types";

export function useKeyboardNavigation({
  filteredItems,
  selectedIds,
  setSelectedIds,
  editingId,
  setEditingId,
  bulkMode,
  setBulkMode,
  searchOpen,
  setSearch,
  setSearchOpen,
  searchInputRef,
  setActiveTabAndUrl,
  setHelpOpen,
  setTagsOpen,
  setShowRead,
  setTagDialogInput,
  setTagDialogOpen,
  tabType,
  handleBulkDelete,
  handleBulkMove,
  cursorRef,
  anchorRef,
  baseSelectionRef,
  setFocusedId,
}: {
  filteredItems: Item[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  editingId: string | null;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  bulkMode: boolean;
  setBulkMode: React.Dispatch<React.SetStateAction<boolean>>;
  searchOpen: boolean;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  setActiveTabAndUrl: (tab: string) => void;
  setHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTagsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRead: React.Dispatch<React.SetStateAction<boolean>>;
  setTagDialogInput: React.Dispatch<React.SetStateAction<string>>;
  setTagDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tabType: string;
  handleBulkDelete: () => void;
  handleBulkMove: () => void;
  cursorRef: React.MutableRefObject<string | null>;
  anchorRef: React.MutableRefObject<string | null>;
  baseSelectionRef: React.MutableRefObject<Set<string>>;
  setFocusedId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const [suppressHover, setSuppressHover] = React.useState(false);
  const store = useStore();

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
          const tempId = store.createItem({
            title: domain,
            url: text,
            tagNames: [],
            type: tabType,
          });
          // Fetch title in background and update
          fetchPageTitle(text).then((title) => {
            if (title) {
              store.updateItem(tempId, { title });
            }
          });
        }
      } catch {
        // not a valid URL, ignore
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [tabType, store]);

  // Cmd+Z / Cmd+Shift+Z for undo/redo
  React.useEffect(() => {
    function handleUndoRedo(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      e.preventDefault();
      if (e.shiftKey) {
        store.redo();
      } else {
        store.undo();
      }
    }
    document.addEventListener("keydown", handleUndoRedo);
    return () => document.removeEventListener("keydown", handleUndoRedo);
  }, [store]);

  // Global keyboard shortcuts: /, 1, 2, ?, a, t, r, Escape
  React.useEffect(() => {
    function handleGlobal(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      // Escape priority chain: editing → search → selection
      if (e.key === "Escape") {
        if (editingId) {
          setEditingId(null);
        } else if (searchOpen) {
          setSearch("");
          setSearchOpen(false);
        } else {
          setSelectedIds(new Set());
          setFocusedId(null);
          cursorRef.current = null;
          anchorRef.current = null;
          baseSelectionRef.current = new Set();
          setBulkMode(false);
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
      // a — add new item
      if (e.key === "a" && !e.metaKey && !e.ctrlKey && !editingId) {
        e.preventDefault();
        setEditingId("new");
      }
      // t — toggle tags filter (when not in bulk mode)
      if (e.key === "t" && !e.metaKey && !e.ctrlKey && !editingId && !bulkMode) {
        e.preventDefault();
        setTagsOpen((v) => !v);
      }
      // r — toggle show read (reading-list tab only)
      if (e.key === "r" && !e.metaKey && !e.ctrlKey && !editingId) {
        e.preventDefault();
        setShowRead((v) => !v);
      }
    }
    document.addEventListener("keydown", handleGlobal);
    return () => document.removeEventListener("keydown", handleGlobal);
  }, [editingId, searchOpen, bulkMode, setEditingId, setSearch, setSearchOpen, setSelectedIds, setBulkMode, searchInputRef, setActiveTabAndUrl, setHelpOpen, setTagsOpen, setShowRead, setFocusedId, cursorRef, anchorRef]);

  // Cmd+Backspace to delete selected items
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === "Backspace" && (e.metaKey || e.ctrlKey) && selectedIds.size > 0 && !editingId) {
        e.preventDefault();
        handleBulkDelete();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, editingId, handleBulkDelete]);

  // Ctrl+N/P navigation, Shift to extend selection, Alt+Ctrl+N/P to reorder
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
        const allItems = store.getAllItems();
        const typeItems = allItems
          .filter((i) => i.type === tabType)
          .sort((a, b) => a.position - b.position);
        const currentIndex = typeItems.findIndex((i) => i.id === selectedId);
        if (currentIndex === -1) return;
        const newIndex = isMoveDown
          ? Math.min(currentIndex + 1, typeItems.length - 1)
          : Math.max(currentIndex - 1, 0);
        if (newIndex === currentIndex) return;
        store.reorderItem(selectedId, tabType, newIndex);
        return;
      }

      // Ctrl+N / Ctrl+P — navigation; Shift to extend selection
      const isDown = e.code === "KeyN" && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      const isUp = e.code === "KeyP" && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      const isShiftDown = e.code === "KeyN" && e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey;
      const isShiftUp = e.code === "KeyP" && e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey;
      if (isDown || isUp || isShiftDown || isShiftUp) {
        e.preventDefault();
        if (ids.length === 0) return;
        const goingDown = isDown || isShiftDown;
        const extending = isShiftDown || isShiftUp;

        let nextId: string;
        if (cursorIdx === -1) {
          nextId = goingDown ? ids[0] : ids[ids.length - 1];
        } else {
          nextId = goingDown
            ? ids[Math.min(cursorIdx + 1, ids.length - 1)]
            : ids[Math.max(cursorIdx - 1, 0)];
        }

        cursorRef.current = nextId;
        setFocusedId(nextId);
        setSuppressHover(true);
        scrollWithMargin(nextId);

        if (extending) {
          // Enter bulk mode if needed, set anchor
          if (!bulkMode) {
            setBulkMode(true);
            // eslint-disable-next-line react-compiler/react-compiler
            anchorRef.current = currentCursor ?? nextId;
            baseSelectionRef.current = new Set(selectedIds);
          }
          // Extend selection: base + range from anchor to cursor
          const anchor = anchorRef.current && ids.includes(anchorRef.current) ? anchorRef.current : nextId;
          const anchorIdx = ids.indexOf(anchor);
          const nextIdx = ids.indexOf(nextId);
          const [start, end] = anchorIdx < nextIdx ? [anchorIdx, nextIdx] : [nextIdx, anchorIdx];
          const newSelection = new Set(baseSelectionRef.current);
          for (let i = start; i <= end; i++) newSelection.add(ids[i]);
          setSelectedIds(newSelection);
        } else if (bulkMode) {
          // In bulk mode without shift: move cursor, lock in selection as base, set new anchor
          anchorRef.current = nextId;
          baseSelectionRef.current = new Set(selectedIds);
        } else {
          // Not in bulk mode: move cursor and select single item
          anchorRef.current = nextId;
          const newSelection = new Set([nextId]);
          setSelectedIds(newSelection);
          baseSelectionRef.current = newSelection;
        }
        return;
      }

      // Enter to edit (only if exactly one item selected)
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && selectedIds.size === 1) {
        e.preventDefault();
        const [id] = selectedIds;
        setEditingId(id);
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

      // t — bulk tag (in bulk mode)
      if (e.key === "t" && !e.metaKey && !e.ctrlKey && bulkMode && selectedIds.size >= 1) {
        e.preventDefault();
        setTagDialogInput("");
        setTagDialogOpen(true);
        return;
      }

      // m — bulk move to other list
      if (e.key === "m" && !e.metaKey && !e.ctrlKey && bulkMode && selectedIds.size >= 1) {
        e.preventDefault();
        handleBulkMove();
        return;
      }
    }
    document.addEventListener("keydown", handleNav);
    return () => document.removeEventListener("keydown", handleNav);
  }, [selectedIds, editingId, filteredItems, bulkMode, handleBulkMove, tabType, store, setSelectedIds, setBulkMode, setEditingId, setTagDialogInput, setTagDialogOpen, setSuppressHover, setFocusedId, cursorRef, anchorRef]);

  return {
    suppressHover,
    setSuppressHover,
  };
}
