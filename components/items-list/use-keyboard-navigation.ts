import React from "react";
import { type QueryClient } from "@tanstack/react-query";

import {
  createItem,
  fetchPageTitle,
  reorderItem,
  updateItem,
} from "@/app/actions";
import { type Item, isReadingListItem } from "@/lib/types";

export function useKeyboardNavigation({
  queryClient,
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
  handleBulkMarkRead,
  handleBulkMove,
  handleDeleteSingle,
  toggleReadMutation,
  cursorRef,
  anchorRef,
  lastClickedRef,
}: {
  queryClient: QueryClient;
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
  handleBulkDelete: () => Promise<void>;
  handleBulkMarkRead: (read: boolean) => Promise<void>;
  handleBulkMove: () => Promise<void>;
  handleDeleteSingle: (itemId: string) => Promise<void>;
  toggleReadMutation: { mutate: (args: { itemId: string; read: boolean }) => void };
  cursorRef: React.MutableRefObject<string | null>;
  anchorRef: React.MutableRefObject<string | null>;
  lastClickedRef: React.MutableRefObject<string | null>;
}) {
  const pendingGRef = React.useRef<number>(0);
  const pendingDRef = React.useRef<number>(0);
  const reorderTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReorderRef = React.useRef<{ itemId: string; type: string } | null>(null);
  const [suppressHover, setSuppressHover] = React.useState(false);

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
          void createItem(domain, text, [], undefined, tabType).then(
            async () => {
              await queryClient.invalidateQueries({ queryKey: ["items"] });
              const title = await fetchPageTitle(text);
              if (title) {
                const freshItems = queryClient.getQueryData<Item[]>(["items"]);
                const created = freshItems?.find(
                  (i) => i.url === text && i.title === domain,
                );
                if (created) {
                  await updateItem(created.id, { title });
                  queryClient.invalidateQueries({ queryKey: ["items"] });
                }
              }
            },
          );
        }
      } catch {
        // not a valid URL, ignore
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [tabType, queryClient]);

  // Global keyboard shortcuts: /, 1, 2, ?, a, t, r, Escape
  React.useEffect(() => {
    function handleSlash(e: KeyboardEvent) {
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
    document.addEventListener("keydown", handleSlash);
    return () => document.removeEventListener("keydown", handleSlash);
  }, [editingId, searchOpen, bulkMode, setEditingId, setSearch, setSearchOpen, setSelectedIds, setBulkMode, searchInputRef, setActiveTabAndUrl, setHelpOpen, setTagsOpen, setShowRead]);

  // Cmd+Backspace to delete selected items
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === "Backspace" && (e.metaKey || e.ctrlKey) && selectedIds.size > 0 && !editingId) {
        e.preventDefault();
        void handleBulkDelete();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, editingId, handleBulkDelete]);

  // Vim-style navigation, visual mode, Enter to edit, Space to toggle read
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

    function moveCursor(nextId: string) {
      cursorRef.current = nextId;
      anchorRef.current = nextId;
      setSelectedIds(new Set([nextId]));
      setBulkMode(false);
      setSuppressHover(true);
      scrollWithMargin(nextId);
    }

    function moveCursorVisual(nextId: string) {
      cursorRef.current = nextId;
      const ids = filteredItems.map((i) => i.id);
      const anchor = anchorRef.current && ids.includes(anchorRef.current) ? anchorRef.current : nextId;
      const anchorIdx = ids.indexOf(anchor);
      const cursorIdx = ids.indexOf(nextId);
      const [start, end] = anchorIdx < cursorIdx ? [anchorIdx, cursorIdx] : [cursorIdx, anchorIdx];
      setSelectedIds(new Set(ids.slice(start, end + 1)));
      setSuppressHover(true);
      scrollWithMargin(nextId);
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

      // Alt+j / Alt+k / Alt+Ctrl+N / Alt+Ctrl+P — move item up/down
      const isMoveDown = (e.altKey && !e.metaKey && !e.shiftKey && (
        (e.code === "KeyJ" && !e.ctrlKey) || (e.code === "KeyN" && e.ctrlKey)
      ));
      const isMoveUp = (e.altKey && !e.metaKey && !e.shiftKey && (
        (e.code === "KeyK" && !e.ctrlKey) || (e.code === "KeyP" && e.ctrlKey)
      ));
      if (isMoveDown || isMoveUp) {
        e.preventDefault();
        if (selectedIds.size !== 1) return;
        const [selectedId] = selectedIds;
        const allItems = queryClient.getQueryData<Item[]>(["items"]) ?? [];
        const typeItems = allItems
          .filter((i) => i.type === tabType)
          .sort((a, b) => a.position - b.position);
        const currentIndex = typeItems.findIndex((i) => i.id === selectedId);
        if (currentIndex === -1) return;
        const newIndex = isMoveDown
          ? Math.min(currentIndex + 1, typeItems.length - 1)
          : Math.max(currentIndex - 1, 0);
        if (newIndex === currentIndex) return;

        // Cancel any inflight refetches so stale data doesn't overwrite optimistic state
        queryClient.cancelQueries({ queryKey: ["items"] });

        // Optimistic local update for immediate animation
        queryClient.setQueryData<Item[]>(["items"], (old) => {
          if (!old) return old;
          const updated = old.map((i) => ({ ...i }));
          const sorted = updated
            .filter((i) => i.type === tabType)
            .sort((a, b) => a.position - b.position);
          const [moved] = sorted.splice(currentIndex, 1);
          sorted.splice(newIndex, 0, moved);
          sorted.forEach((item, idx) => { item.position = idx; });
          return updated;
        });

        // Debounce the server call — read final position from cache at flush time
        pendingReorderRef.current = { itemId: selectedId, type: tabType };
        if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
        reorderTimerRef.current = setTimeout(() => {
          const pending = pendingReorderRef.current;
          if (!pending) return;
          pendingReorderRef.current = null;
          const cached = queryClient.getQueryData<Item[]>(["items"]) ?? [];
          const finalPosition = cached
            .filter((i) => i.type === pending.type)
            .sort((a, b) => a.position - b.position)
            .findIndex((i) => i.id === pending.itemId);
          if (finalPosition === -1) return;
          reorderItem(pending.itemId, pending.type, finalPosition).then(() =>
            queryClient.invalidateQueries({ queryKey: ["items"] })
          );
        }, 300);
        return;
      }

      // j / k / Ctrl+N / Ctrl+P — navigation; hold Shift to extend selection
      const isDown = (e.key === "j" && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey)
        || (e.key === "n" && e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey);
      const isUp = (e.key === "k" && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey)
        || (e.key === "p" && e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey);
      const isShiftDown = (e.key === "J" && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey)
        || (e.key === "N" && e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey);
      const isShiftUp = (e.key === "K" && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey)
        || (e.key === "P" && e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey);
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
        if (bulkMode || extending) {
          if (!bulkMode) {
            setBulkMode(true);
            anchorRef.current = currentCursor ?? nextId;
          }
          moveCursorVisual(nextId);
        } else {
          moveCursor(nextId);
        }
        return;
      }

      // G (Shift+g) — jump to last item
      if (e.key === "G" && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        pendingGRef.current = 0;
        if (ids.length === 0) return;
        if (bulkMode) {
          moveCursorVisual(ids[ids.length - 1]);
        } else {
          moveCursor(ids[ids.length - 1]);
        }
        return;
      }

      // g — first press sets pending, second press (gg) jumps to first item
      if (e.key === "g" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        const now = Date.now();
        if (now - pendingGRef.current < 300) {
          e.preventDefault();
          pendingGRef.current = 0;
          if (ids.length === 0) return;
          if (bulkMode) {
            moveCursorVisual(ids[0]);
          } else {
            moveCursor(ids[0]);
          }
        } else {
          pendingGRef.current = now;
        }
        return;
      }

      // Ctrl+D / Ctrl+U — half-page jump (~10 items)
      if ((e.key === "d" || e.key === "u") && e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (ids.length === 0) return;
        const jump = 10;
        let nextId: string;
        if (cursorIdx === -1) {
          nextId = e.key === "d" ? ids[Math.min(jump - 1, ids.length - 1)] : ids[0];
        } else {
          nextId = e.key === "d"
            ? ids[Math.min(cursorIdx + jump, ids.length - 1)]
            : ids[Math.max(cursorIdx - jump, 0)];
        }
        if (bulkMode) {
          moveCursorVisual(nextId);
        } else {
          moveCursor(nextId);
        }
        return;
      }

      // dd — delete selected items
      if (e.key === "d" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const now = Date.now();
        if (now - pendingDRef.current < 300) {
          e.preventDefault();
          pendingDRef.current = 0;
          if (selectedIds.size > 0) {
            if (bulkMode && selectedIds.size > 1) {
              void handleBulkDelete();
            } else {
              const id = cursorRef.current && selectedIds.has(cursorRef.current)
                ? cursorRef.current
                : Array.from(selectedIds)[0];
              void handleDeleteSingle(id);
            }
          }
        } else {
          pendingDRef.current = now;
        }
        return;
      }

      // v / V — toggle visual (bulk) mode
      if (e.key === "v" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (bulkMode) {
          setBulkMode(false);
          setSelectedIds(new Set());
        } else {
          setBulkMode(true);
          const target = currentCursor && ids.includes(currentCursor) ? currentCursor : ids[0];
          if (target) {
            cursorRef.current = target;
            anchorRef.current = target;
            setSelectedIds(new Set([target]));
          }
        }
        return;
      }

      // o — open selected in new tab
      if (e.key === "o" && !e.metaKey && !e.ctrlKey && !e.shiftKey && selectedIds.size >= 1) {
        e.preventDefault();
        for (const id of selectedIds) {
          const item = filteredItems.find((i) => i.id === id);
          if (item) window.open(item.url, "_blank");
        }
        return;
      }

      // x — toggle read on selected
      if (e.key === "x" && !e.metaKey && !e.ctrlKey && !e.shiftKey && selectedIds.size > 0) {
        e.preventDefault();
        const selectedItems = filteredItems
          .filter((i) => selectedIds.has(i.id))
          .filter(isReadingListItem);
        if (selectedItems.length === 0) return;
        const allRead = selectedItems.every((i) => i.read);
        if (selectedItems.length === 1) {
          toggleReadMutation.mutate({ itemId: selectedItems[0].id, read: !selectedItems[0].read });
        } else {
          void handleBulkMarkRead(!allRead);
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

      // Enter to edit (only if exactly one item selected)
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && selectedIds.size === 1) {
        e.preventDefault();
        const [id] = selectedIds;
        setEditingId(id);
      }

      // Space to toggle read on all selected (reading-list only)
      if (e.key === " " && selectedIds.size > 0) {
        e.preventDefault();
        const selectedItems = filteredItems
          .filter((i) => selectedIds.has(i.id))
          .filter(isReadingListItem);
        if (selectedItems.length === 0) return;
        const allRead = selectedItems.every((i) => i.read);
        if (selectedItems.length === 1) {
          toggleReadMutation.mutate({ itemId: selectedItems[0].id, read: !selectedItems[0].read });
        } else {
          void handleBulkMarkRead(!allRead);
        }
      }

      // t — bulk tag (in bulk mode)
      if (e.key === "t" && !e.metaKey && !e.ctrlKey && bulkMode && selectedIds.size >= 1) {
        e.preventDefault();
        setTagDialogInput("");
        setTagDialogOpen(true);
      }

      // m — bulk move to other list
      if (e.key === "m" && !e.metaKey && !e.ctrlKey && bulkMode && selectedIds.size >= 1) {
        e.preventDefault();
        void handleBulkMove();
      }
    }
    document.addEventListener("keydown", handleNav);
    return () => document.removeEventListener("keydown", handleNav);
  }, [selectedIds, editingId, filteredItems, bulkMode, handleBulkMarkRead, handleBulkMove, handleBulkDelete, handleDeleteSingle, tabType, queryClient, setSelectedIds, setBulkMode, setEditingId, setTagDialogInput, setTagDialogOpen, toggleReadMutation]);

  return {
    cursorRef,
    anchorRef,
    lastClickedRef,
    suppressHover,
    setSuppressHover,
  };
}
