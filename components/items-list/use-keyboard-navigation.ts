import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { reorderItem } from "@/app/actions";
import { type Item } from "@/lib/types";
import { isTypingContext, isOverlayOpen } from "@/lib/input-context";
import { type TabId } from "@/components/items-list/use-filters";

export const useKeyboardNavigation = ({
  filteredItems,
  selectedId,
  setSelectedId,
  editingId,
  setEditingId,
  setActiveTabAndUrl,
  setTagsOpen,
  setShowRead,
  tabType,
  tabItems,
  cursorRef,
  setCursor,
  onRequestDelete,
  activeTags,
  onPasteCreate,
}: {
  filteredItems: Item[];
  selectedId: string | null;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  editingId: string | null;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveTabAndUrl: (tab: TabId) => void;
  setTagsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRead: React.Dispatch<React.SetStateAction<boolean>>;
  tabType: string;
  tabItems: Item[];
  cursorRef: React.RefObject<string | null>;
  setCursor: (id: string | null) => void;
  onRequestDelete?: () => void;
  activeTags: Set<string>;
  onPasteCreate: (url: string, tagNames: string[]) => void;
}) => {
  const [suppressHover, setSuppressHover] = React.useState(false);
  const queryClient = useQueryClient();
  const invalidate = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["items"] }),
    [queryClient],
  );

  const reorderMutation = useMutation({
    mutationFn: (args: { id: string; type: string; newPosition: number }) =>
      reorderItem(args.id, args.type, args.newPosition),
    onSuccess: invalidate,
  });

  // Cmd+V to quick-add a URL
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isTypingContext(e) || isOverlayOpen()) return;
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;
      try {
        const url = new URL(text);
        if (url.protocol === "http:" || url.protocol === "https:") {
          e.preventDefault();
          onPasteCreate(text, [...activeTags]);
        }
      } catch {
        // not a valid URL, ignore
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [onPasteCreate, activeTags]);

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handleGlobal = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Let dialogs / drawers / dropdowns handle their own Escape first.
        if (isOverlayOpen()) return;
        if (editingId) {
          setEditingId(null);
        } else {
          const panel = document.querySelector("[data-detail-panel]");
          if (panel?.contains(e.target as Node)) {
            (e.target as HTMLElement)?.blur?.();
          } else {
            setSelectedId(null);
            setCursor(null);
          }
        }
        return;
      }
      if (isTypingContext(e)) return;
      if (e.key === "1" && !e.metaKey && !e.ctrlKey) setActiveTabAndUrl("reading-list");
      if (e.key === "2" && !e.metaKey && !e.ctrlKey) setActiveTabAndUrl("cards");
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
    };
    document.addEventListener("keydown", handleGlobal);
    return () => document.removeEventListener("keydown", handleGlobal);
  }, [editingId, setEditingId, setSelectedId, setActiveTabAndUrl, setTagsOpen, setShowRead, cursorRef, setCursor]);

  // Cmd+Backspace to delete selected item
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingContext(e) || isOverlayOpen()) return;
      if (e.key === "Backspace" && (e.metaKey || e.ctrlKey) && selectedId !== null && !editingId) {
        e.preventDefault();
        onRequestDelete?.();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, editingId, onRequestDelete]);

  // Ctrl+N/P navigation, Alt+Ctrl+N/P to reorder
  React.useEffect(() => {
    const scrollWithMargin = (id: string) => {
      const el = document.querySelector(`[data-item-id="${id}"]`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = rect.height * 3;
      if (rect.top - margin < 0) {
        window.scrollBy({ top: rect.top - margin });
      } else if (rect.bottom + margin > window.innerHeight) {
        window.scrollBy({ top: rect.bottom + margin - window.innerHeight });
      }
    };

    const handleNav = (e: KeyboardEvent) => {
      if (isTypingContext(e)) return;
      const elementTag = (e.target as HTMLElement)?.tagName;
      if (elementTag === "BUTTON" || elementTag === "A") return;
      if (editingId) return;

      const ids = filteredItems.map((i) => i.id);
      const currentCursor = cursorRef.current;
      const cursorIdx = currentCursor ? ids.indexOf(currentCursor) : -1;

      // Alt+Ctrl+N/P — move item
      const isMoveDown = e.altKey && e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === "KeyN";
      const isMoveUp = e.altKey && e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === "KeyP";
      if (isMoveDown || isMoveUp) {
        e.preventDefault();
        if (selectedId === null) return;
        const sortedItems = [...tabItems].sort((a, b) => a.position - b.position);
        const currentIndex = sortedItems.findIndex((i) => i.id === selectedId);
        if (currentIndex === -1) return;
        const newIndex = isMoveDown
          ? Math.min(currentIndex + 1, sortedItems.length - 1)
          : Math.max(currentIndex - 1, 0);
        if (newIndex === currentIndex) return;
        reorderMutation.mutate({ id: selectedId, type: tabType, newPosition: newIndex });
        return;
      }

      // Ctrl+N/P — navigation
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
        setSelectedId(nextId);
        return;
      }

      // Enter to focus detail panel title
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && selectedId !== null) {
        if (isOverlayOpen()) return;
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>("[data-detail-title]");
        if (el) {
          el.focus();
        } else {
          setEditingId(selectedId);
        }
        return;
      }

      // Cmd+Enter to open in new tab
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && selectedId !== null) {
        if (isOverlayOpen()) return;
        e.preventDefault();
        const item = filteredItems.find((i) => i.id === selectedId);
        if (item?.url && URL.canParse(item.url)) window.open(item.url, "_blank");
        return;
      }
    };
    document.addEventListener("keydown", handleNav);
    return () => document.removeEventListener("keydown", handleNav);
  }, [selectedId, editingId, filteredItems, tabType, tabItems, setSelectedId, setEditingId, setSuppressHover, cursorRef, setCursor, reorderMutation]);

  return {
    suppressHover,
    setSuppressHover,
  };
};
