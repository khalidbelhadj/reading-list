import React from "react";
import { toast } from "sonner";

import { type Item } from "@/lib/types";
import { isTypingContext, isOverlayOpen, isModKey } from "@/lib/input-context";
import { dispatchPanelCommand } from "@/lib/panel-events";
import { setDismissFallback } from "@/lib/dismiss-stack";
import type { TabId } from "@/components/items-list/use-filters";

export const useKeyboardNavigation = ({
  filteredItems,
  setActiveTabAndUrl,
  setTagsOpen,
  setShowRead,
  cursorRef,
  setCursor,
  onRequestDelete,
  activeTags,
  onOpenItem,
  onOpenItemExpanded,
  onOpenNew,
  onPasteCreate,
  onSearchOpen,
  onToggleReadCursor,
  onChatCursor,
  onToggleDensity,
  onToggleTheme,
  onShowShortcuts,
}: {
  filteredItems: Item[];
  setActiveTabAndUrl: (tab: TabId) => void;
  setTagsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRead: React.Dispatch<React.SetStateAction<boolean>>;
  cursorRef: React.RefObject<string | null>;
  setCursor: (id: string | null) => void;
  onRequestDelete?: () => void;
  activeTags: Set<string>;
  onOpenItem: (id: string) => void;
  onOpenItemExpanded: (id: string) => void;
  onOpenNew: () => void;
  onPasteCreate: (url: string, tagNames: string[]) => void;
  onSearchOpen: () => void;
  onToggleReadCursor: () => void;
  onChatCursor: () => void;
  onToggleDensity: () => void;
  onToggleTheme: () => void;
  onShowShortcuts: () => void;
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
      toast.error("Invalid URL", {
        description: "Your clipboard doesn't contain a valid URL.",
      });
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [onPasteCreate, activeTags]);

  // Escape's fall-through default (lib/dismiss-stack.ts rule 5): when nothing
  // dismissible is open — no overlay, no panel, no search — Escape clears the
  // list cursor. Every other Escape behavior is owned by a dismiss layer, so we
  // no longer hand-check panel/overlay state here.
  React.useEffect(() => setDismissFallback(() => setCursor(null)), [setCursor]);

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handleGlobal = (e: KeyboardEvent) => {
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
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onShowShortcuts();
      }
    };
    document.addEventListener("keydown", handleGlobal);
    return () => document.removeEventListener("keydown", handleGlobal);
  }, [setActiveTabAndUrl, setTagsOpen, setShowRead, setCursor, onOpenNew, onSearchOpen, onShowShortcuts]);

  // Command shortcuts for search + panel view transitions. Unlike the shortcuts
  // above, these are NOT gated on isTypingContext: Cmd+K should jump to search
  // and Cmd+[ should collapse the panel even while the cursor is in the panel's
  // title/notes editor.
  //   Cmd/Ctrl+K — focus search; if an item is in full view, pop it back to
  //                side view so the list (and search box) are visible.
  //   Cmd/Ctrl+[ — expand the panel a step (side → fullw).
  //   Cmd/Ctrl+] — collapse the panel a step (fullw → side → closed).
  React.useEffect(() => {
    const handleCommand = (e: KeyboardEvent) => {
      if (!isModKey(e) || e.altKey || e.shiftKey) return;
      if (isOverlayOpen()) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        dispatchPanelCommand("peek");
        onSearchOpen();
      } else if (e.key === "[") {
        e.preventDefault();
        dispatchPanelCommand("expand");
      } else if (e.key === "]") {
        e.preventDefault();
        dispatchPanelCommand("collapse");
      }
    };
    document.addEventListener("keydown", handleCommand);
    return () => document.removeEventListener("keydown", handleCommand);
  }, [onSearchOpen]);

  // Cmd/Ctrl+Shift command shortcuts. Like the handler above, these are NOT
  // gated on isTypingContext so they fire from anywhere — including the
  // detail-panel editor. The item-scoped ones act on the list cursor.
  //   ⌘⇧M — mark the cursor item read / unread
  //   ⌘⇧J — chat with Claude about the cursor item
  //   ⌘⇧V — toggle list density (cozy ↔ compact)
  //   ⌘⇧L — toggle theme (light ↔ dark)
  React.useEffect(() => {
    const handleModShift = (e: KeyboardEvent) => {
      if (!isModKey(e) || !e.shiftKey || e.altKey) return;
      if (isOverlayOpen()) return;
      switch (e.key.toLowerCase()) {
        case "m":
          e.preventDefault();
          onToggleReadCursor();
          break;
        case "j":
          e.preventDefault();
          onChatCursor();
          break;
        case "v":
          e.preventDefault();
          onToggleDensity();
          break;
        case "l":
          e.preventDefault();
          onToggleTheme();
          break;
      }
    };
    document.addEventListener("keydown", handleModShift);
    return () => document.removeEventListener("keydown", handleModShift);
  }, [onToggleReadCursor, onChatCursor, onToggleDensity, onToggleTheme]);

  // Cmd+Backspace to delete cursor item
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingContext(e) || isOverlayOpen()) return;
      if (e.key === "Backspace" && isModKey(e) && cursorRef.current !== null) {
        e.preventDefault();
        onRequestDelete?.();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cursorRef, onRequestDelete]);

  // Ctrl+N/P navigation
  React.useEffect(() => {
    const scrollWithMargin = (id: string) => {
      const el = document.querySelector<HTMLElement>(`[data-item-id="${id}"]`);
      if (!el) return;
      // Walk up to find the row's scrollable ancestor — the list now lives
      // inside a scrolling container, not the window.
      let container: HTMLElement | null = el.parentElement;
      while (container) {
        const overflowY = getComputedStyle(container).overflowY;
        if (overflowY === "auto" || overflowY === "scroll") break;
        container = container.parentElement;
      }
      if (!container) return;
      const rect = el.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
      const margin = rect.height * 3;
      if (rect.top - margin < cRect.top) {
        container.scrollBy({ top: rect.top - cRect.top - margin });
      } else if (rect.bottom + margin > cRect.bottom) {
        container.scrollBy({ top: rect.bottom - cRect.bottom + margin });
      }
    };

    const handleNav = (e: KeyboardEvent) => {
      if (isTypingContext(e)) return;
      const elementTag = (e.target as HTMLElement)?.tagName;
      const onInteractive = elementTag === "BUTTON" || elementTag === "A";

      // Use the live render order from the DOM (grouped / pinned / collapsed
      // sections diverge from filteredItems' raw order).
      const ids = Array.from(
        document.querySelectorAll<HTMLElement>("[data-item-id]"),
      )
        .map((el) => el.dataset.itemId)
        .filter((id): id is string => !!id);
      const currentCursor = cursorRef.current;
      const cursorIdx = currentCursor ? ids.indexOf(currentCursor) : -1;

      // Ctrl+N/P, ArrowDown/Up, j/k, Tab/Shift+Tab — navigation
      const noMods = !e.ctrlKey && !e.metaKey && !e.altKey;

      // When focus rests on a button/link (e.g. a delete dialog just restored
      // focus to its trigger, or the toolbar is focused), Tab/arrows/Enter keep
      // their native meaning — but the unambiguous Ctrl+N/P and j/k shortcuts
      // should still drive the list cursor so navigation survives a delete.
      const isExplicitNav =
        (e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !e.shiftKey &&
          (e.code === "KeyN" || e.code === "KeyP")) ||
        ((e.code === "KeyJ" || e.code === "KeyK") && noMods && !e.shiftKey);
      if (onInteractive && !isExplicitNav) return;
      const isDown =
        (e.code === "KeyN" && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) ||
        (e.key === "ArrowDown" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) ||
        (e.code === "KeyJ" && noMods && !e.shiftKey) ||
        (e.key === "Tab" && noMods && !e.shiftKey);
      const isUp =
        (e.code === "KeyP" && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) ||
        (e.key === "ArrowUp" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) ||
        (e.code === "KeyK" && noMods && !e.shiftKey) ||
        (e.key === "Tab" && noMods && e.shiftKey);
      if (isDown || isUp) {
        e.preventDefault();
        if (ids.length === 0) return;
        // No cursor yet — adopt the mouse-hovered row as the starting point
        // so the first arrow press picks it up instead of jumping to an edge.
        if (cursorIdx === -1) {
          const hovered = document.querySelector<HTMLElement>(
            "[data-item-id]:hover",
          );
          const hoveredId = hovered?.dataset.itemId;
          if (hoveredId && ids.includes(hoveredId)) {
            setCursor(hoveredId);
            setSuppressHover(true);
            scrollWithMargin(hoveredId);
            return;
          }
        }
        const nextId =
          cursorIdx === -1
            ? isDown
              ? ids[0]
              : ids[ids.length - 1]
            : isDown
              ? ids[Math.min(cursorIdx + 1, ids.length - 1)]
              : ids[Math.max(cursorIdx - 1, 0)];
        setCursor(nextId);
        setSuppressHover(true);
        scrollWithMargin(nextId);
        return;
      }

      // Enter to open item in side panel
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey && currentCursor !== null) {
        if (isOverlayOpen()) return;
        e.preventDefault();
        onOpenItem(currentCursor);
        return;
      }

      // Cmd+Shift+Enter to open the item's URL in a new tab
      if (e.key === "Enter" && isModKey(e) && e.shiftKey && currentCursor !== null) {
        if (isOverlayOpen()) return;
        e.preventDefault();
        const item = filteredItems.find((i) => i.id === currentCursor);
        if (item?.url && URL.canParse(item.url)) window.open(item.url, "_blank");
        return;
      }

      // Cmd+Enter to open the item expanded
      if (e.key === "Enter" && isModKey(e) && !e.shiftKey && currentCursor !== null) {
        if (isOverlayOpen()) return;
        e.preventDefault();
        onOpenItemExpanded(currentCursor);
        return;
      }
    };
    document.addEventListener("keydown", handleNav);
    return () => document.removeEventListener("keydown", handleNav);
  }, [filteredItems, setSuppressHover, cursorRef, setCursor, onOpenItem, onOpenItemExpanded]);

  return {
    suppressHover,
    setSuppressHover,
  };
};
