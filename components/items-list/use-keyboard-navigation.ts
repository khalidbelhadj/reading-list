import React from "react";
import { toast } from "sonner";

import { type Item } from "@/lib/types";
import { isTypingContext, isOverlayOpen } from "@/lib/input-context";
import type { TabId } from "@/components/items-list/use-filters";

export const useKeyboardNavigation = ({
  filteredItems,
  setActiveTabAndUrl,
  setTagsOpen,
  setShowRead,
  tabItems,
  cursorRef,
  setCursor,
  onRequestDelete,
  activeTags,
  onOpenItem,
  onOpenNew,
  onPasteCreate,
  onSearchOpen,
  onReorder,
}: {
  filteredItems: Item[];
  setActiveTabAndUrl: (tab: TabId) => void;
  setTagsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRead: React.Dispatch<React.SetStateAction<boolean>>;
  tabItems: Item[];
  cursorRef: React.RefObject<string | null>;
  setCursor: (id: string | null) => void;
  onRequestDelete?: () => void;
  activeTags: Set<string>;
  onOpenItem: (id: string) => void;
  onOpenNew: () => void;
  onPasteCreate: (url: string, tagNames: string[]) => void;
  onSearchOpen: () => void;
  onReorder: (itemId: string, newPosition: number) => void;
}) => {
  const [suppressHover, setSuppressHover] = React.useState(false);

  // Cmd+V to quick-add a URL
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isTypingContext(e) || isOverlayOpen()) return;
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;
      e.preventDefault();
      try {
        const url = new URL(text);
        if (url.protocol === "http:" || url.protocol === "https:") {
          onPasteCreate(text, [...activeTags]);
          return;
        }
      } catch {
        // fall through to error toast
      }
      toast.error("Clipboard doesn't contain a valid URL");
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [onPasteCreate, activeTags]);

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handleGlobal = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isOverlayOpen()) return;
        setCursor(null);
        return;
      }
      if (isTypingContext(e)) return;
      if (e.key === "1" && !e.metaKey && !e.ctrlKey) setActiveTabAndUrl("reading-list");
      if (e.key === "2" && !e.metaKey && !e.ctrlKey) setActiveTabAndUrl("cards");
      if (e.key === "a" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onOpenNew();
      }
      if (e.key === "t" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setTagsOpen((v) => !v);
      }
      if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowRead((v) => !v);
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onSearchOpen();
      }
    };
    document.addEventListener("keydown", handleGlobal);
    return () => document.removeEventListener("keydown", handleGlobal);
  }, [setActiveTabAndUrl, setTagsOpen, setShowRead, setCursor, onOpenNew, onSearchOpen]);

  // Cmd+Backspace to delete cursor item
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingContext(e) || isOverlayOpen()) return;
      if (e.key === "Backspace" && (e.metaKey || e.ctrlKey) && cursorRef.current !== null) {
        e.preventDefault();
        onRequestDelete?.();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cursorRef, onRequestDelete]);

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

      const ids = filteredItems.map((i) => i.id);
      const currentCursor = cursorRef.current;
      const cursorIdx = currentCursor ? ids.indexOf(currentCursor) : -1;

      // Alt+Ctrl+N/P — move item
      const isMoveDown = e.altKey && e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === "KeyN";
      const isMoveUp = e.altKey && e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === "KeyP";
      if (isMoveDown || isMoveUp) {
        e.preventDefault();
        if (currentCursor === null) return;
        const sortedItems = [...tabItems].sort((a, b) => a.position - b.position);
        const currentIndex = sortedItems.findIndex((i) => i.id === currentCursor);
        if (currentIndex === -1) return;
        const newIndex = isMoveDown
          ? Math.min(currentIndex + 1, sortedItems.length - 1)
          : Math.max(currentIndex - 1, 0);
        if (newIndex === currentIndex) return;
        onReorder(currentCursor, newIndex);
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
        return;
      }

      // Enter to open item page
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && currentCursor !== null) {
        if (isOverlayOpen()) return;
        e.preventDefault();
        onOpenItem(currentCursor);
        return;
      }

      // Cmd+Enter to open in new tab
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && currentCursor !== null) {
        if (isOverlayOpen()) return;
        e.preventDefault();
        const item = filteredItems.find((i) => i.id === currentCursor);
        if (item?.url && URL.canParse(item.url)) window.open(item.url, "_blank");
        return;
      }
    };
    document.addEventListener("keydown", handleNav);
    return () => document.removeEventListener("keydown", handleNav);
  }, [filteredItems, tabItems, setSuppressHover, cursorRef, setCursor, onOpenItem, onReorder]);

  return {
    suppressHover,
    setSuppressHover,
  };
};
