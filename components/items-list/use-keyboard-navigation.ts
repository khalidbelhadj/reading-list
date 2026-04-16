import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  fetchPageTitle,
  createItem,
  updateItem,
  reorderItem,
} from "@/app/actions";
import { type Item } from "@/lib/types";

export const useKeyboardNavigation = ({
  filteredItems,
  selectedId,
  setSelectedId,
  editingId,
  setEditingId,
  searchOpen,
  setSearch,
  setSearchOpen,
  searchInputRef,
  setActiveTabAndUrl,
  setTagsOpen,
  setShowRead,
  tabType,
  tabItems,
  cursorRef,
  setCursor,
  onRequestDelete,
}: {
  filteredItems: Item[];
  selectedId: string | null;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  editingId: string | null;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  searchOpen: boolean;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  setActiveTabAndUrl: (tab: string) => void;
  setTagsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRead: React.Dispatch<React.SetStateAction<boolean>>;
  tabType: string;
  tabItems: Item[];
  cursorRef: React.RefObject<string | null>;
  setCursor: (id: string | null) => void;
  onRequestDelete?: () => void;
}) => {
  const [suppressHover, setSuppressHover] = React.useState(false);
  const queryClient = useQueryClient();
  const invalidate = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["items"] }),
    [queryClient],
  );

  const createMutation = useMutation({
    mutationFn: (args: { title: string; url: string; type: string }) =>
      createItem(args.title, args.url, [], undefined, args.type),
    onSuccess: (itemId, vars) => {
      invalidate();
      if (itemId) {
        fetchPageTitle(vars.url).then((title) => {
          if (title) {
            updateItem(itemId, { title }).then(invalidate);
          }
        });
      }
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (args: { id: string; type: string; newPosition: number }) =>
      reorderItem(args.id, args.type, args.newPosition),
    onSuccess: invalidate,
  });

  // Cmd+V to quick-add a URL
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const elementTag = (e.target as HTMLElement)?.tagName;
      if (
        elementTag === "INPUT" ||
        elementTag === "TEXTAREA" ||
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
          createMutation.mutate({ title: domain, url: text, type: tabType });
        }
      } catch {
        // not a valid URL, ignore
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [tabType, createMutation]);

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handleGlobal = (e: KeyboardEvent) => {
      const elementTag = (e.target as HTMLElement)?.tagName;
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
            setSelectedId(null);
            setCursor(null);
          }
        }
        return;
      }
      if (elementTag === "INPUT" || elementTag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
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
  }, [editingId, searchOpen, setEditingId, setSearch, setSearchOpen, setSelectedId, searchInputRef, setActiveTabAndUrl, setTagsOpen, setShowRead, cursorRef, setCursor]);

  // Cmd+Backspace to delete selected item
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const elementTag = (e.target as HTMLElement)?.tagName;
      if (elementTag === "INPUT" || elementTag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
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
      const elementTag = (e.target as HTMLElement)?.tagName;
      if (
        elementTag === "INPUT" ||
        elementTag === "TEXTAREA" ||
        elementTag === "BUTTON" ||
        elementTag === "A" ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;
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
        // Don't open URLs if a dialog is open
        if (document.querySelector("[role=alertdialog], [role=dialog]")) return;
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
