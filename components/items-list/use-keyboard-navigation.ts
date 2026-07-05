import React from "react";
import { toast } from "sonner";

import { type Item } from "@/lib/types";
import { isTypingContext, isOverlayOpen, isModKey } from "@/lib/input-context";
import { dispatchPanelCommand } from "@/lib/panel-events";
import { setDismissFallback } from "@/lib/dismiss-stack";

// NOTE: This hook is the source of truth for the app's keyboard shortcuts.
// Whenever you add, remove, or change a binding here, mirror it in the
// `?` shortcuts dialog by updating `getShortcutGroups()` in `lib/shortcuts.ts`
// — that list is presentational only and won't update itself.

export const useKeyboardNavigation = ({
  filteredItems,
  getOrderedIds,
  scrollToId,
  setTagsOpen,
  setShowRead,
  cursorRef,
  setCursor,
  onRequestDelete,
  onExtendSelection,
  onSelectAll,
  onEscapeFallback,
  activeTags,
  onOpenItem,
  onOpenItemExpanded,
  onOpenNew,
  onPasteCreate,
  onSearchOpen,
  onToggleReadCursor,
  onTogglePinCursor,
  onChatCursor,
  onToggleDensity,
  onToggleTheme,
  onShowShortcuts,
}: {
  filteredItems: Item[];
  // The cursor's visual order, reconstructed from data so it stays correct even
  // when the virtualized flat list has off-screen (unmounted) rows.
  getOrderedIds: () => string[];
  // Scrolls a row into view, driving the virtualizer when the row is unmounted.
  scrollToId: (id: string) => void;
  setTagsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRead: React.Dispatch<React.SetStateAction<boolean>>;
  cursorRef: React.RefObject<string | null>;
  setCursor: (id: string | null) => void;
  onRequestDelete?: () => void;
  // Multi-select: Shift+↑/↓ extends the selection from its anchor, ⌘A selects
  // every visible row. See use-selection.ts for the range semantics.
  onExtendSelection: (direction: "next" | "prev") => void;
  onSelectAll: () => void;
  // Escape's fall-through default (dismiss-stack rule 5). The selection is its
  // own dismiss layer now, so by the time the stack is empty this only clears
  // the list cursor.
  onEscapeFallback: () => void;
  activeTags: Set<string>;
  onOpenItem: (id: string) => void;
  onOpenItemExpanded: (id: string) => void;
  onOpenNew: () => void;
  onPasteCreate: (url: string, tagNames: string[]) => void;
  onSearchOpen: () => void;
  onToggleReadCursor: () => void;
  onTogglePinCursor: () => void;
  onChatCursor: () => void;
  onToggleDensity: () => void;
  onToggleTheme: () => void;
  onShowShortcuts: () => void;
}) => {
  const [suppressHover, setSuppressHover] = React.useState(false);
  // Ref mirror so the keydown handler can read the live value without
  // re-binding the listener every time it toggles. suppressHover is true right
  // after a key nav and flips back to false on the next mousemove, so
  // `!suppressHoverRef.current` means "the mouse has moved more recently than
  // the last key" — i.e. the user is actively hovering.
  const suppressHoverRef = React.useRef(suppressHover);
  suppressHoverRef.current = suppressHover;

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
  // dismissible is open — no overlay, no panel, no search, no selection — Escape
  // clears the list cursor. Every other Escape behavior (including clearing the
  // selection) is owned by a dismiss layer, so we no longer hand-check
  // panel/overlay state here.
  React.useEffect(
    () => setDismissFallback(onEscapeFallback),
    [onEscapeFallback],
  );

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handleGlobal = (e: KeyboardEvent) => {
      if (isTypingContext(e)) return;
      if (e.key === "a" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onOpenNew();
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
  }, [setCursor, onOpenNew, onSearchOpen, onShowShortcuts]);

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
  //   ⌘⇧P — pin / unpin the cursor item
  //   ⌘⇧J — chat with Claude about the cursor item
  //   ⌘⇧V — toggle list density (cozy ↔ compact)
  //   ⌘⇧L — toggle theme (light ↔ dark)
  //   ⌘⇧F — toggle the tag filter
  //   ⌘⇧H — show / hide read items
  React.useEffect(() => {
    const handleModShift = (e: KeyboardEvent) => {
      if (!isModKey(e) || !e.shiftKey || e.altKey) return;
      if (isOverlayOpen()) return;
      switch (e.key.toLowerCase()) {
        case "m":
          e.preventDefault();
          onToggleReadCursor();
          break;
        case "p":
          e.preventDefault();
          onTogglePinCursor();
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
        case "f":
          e.preventDefault();
          setTagsOpen((v) => !v);
          break;
        case "h":
          e.preventDefault();
          setShowRead((v) => !v);
          break;
      }
    };
    document.addEventListener("keydown", handleModShift);
    return () => document.removeEventListener("keydown", handleModShift);
  }, [
    onToggleReadCursor,
    onTogglePinCursor,
    onChatCursor,
    onToggleDensity,
    onToggleTheme,
    setTagsOpen,
    setShowRead,
  ]);

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
    const handleNav = (e: KeyboardEvent) => {
      if (isTypingContext(e)) return;
      const elementTag = (e.target as HTMLElement)?.tagName;
      const onInteractive = elementTag === "BUTTON" || elementTag === "A";

      // The cursor's visual order, reconstructed from data (grouped / pinned /
      // collapsed sections diverge from filteredItems' raw order, and the flat
      // list's off-screen rows aren't in the DOM to query).
      const ids = getOrderedIds();
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

      // Jump to the first / last row in the list. ⌘↑ / ⌘⇧< → start,
      // ⌘↓ / ⌘⇧> → end. Works on whatever's currently rendered, so it follows
      // search results, filters, and grouping. (With Shift held, "," and "."
      // arrive as "<" and ">" on most layouts; fall back to e.code too.)
      const isJumpStart =
        (e.key === "ArrowUp" && isModKey(e) && !e.shiftKey && !e.altKey) ||
        ((e.key === "<" || e.code === "Comma") &&
          isModKey(e) &&
          e.shiftKey &&
          !e.altKey);
      const isJumpEnd =
        (e.key === "ArrowDown" && isModKey(e) && !e.shiftKey && !e.altKey) ||
        ((e.key === ">" || e.code === "Period") &&
          isModKey(e) &&
          e.shiftKey &&
          !e.altKey);
      if (isJumpStart || isJumpEnd) {
        e.preventDefault();
        if (ids.length === 0) return;
        const nextId = isJumpStart ? ids[0] : ids[ids.length - 1];
        if (!nextId) return;
        setCursor(nextId);
        setSuppressHover(true);
        scrollToId(nextId);
        return;
      }

      // Shift+↑/↓ — extend the multi-selection one row at a time.
      const isExtendDown =
        e.key === "ArrowDown" &&
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey;
      const isExtendUp =
        e.key === "ArrowUp" &&
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey;
      if (isExtendDown || isExtendUp) {
        e.preventDefault();
        onExtendSelection(isExtendDown ? "next" : "prev");
        setSuppressHover(true);
        return;
      }

      // ⌘A — select every visible row.
      if (e.code === "KeyA" && isModKey(e) && !e.shiftKey && !e.altKey) {
        if (isOverlayOpen()) return;
        e.preventDefault();
        onSelectAll();
        return;
      }

      const isDown =
        (e.code === "KeyN" &&
          e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !e.shiftKey) ||
        (e.key === "ArrowDown" &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !e.shiftKey) ||
        (e.code === "KeyJ" && noMods && !e.shiftKey) ||
        (e.key === "Tab" && noMods && !e.shiftKey);
      const isUp =
        (e.code === "KeyP" &&
          e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !e.shiftKey) ||
        (e.key === "ArrowUp" &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !e.shiftKey) ||
        (e.code === "KeyK" && noMods && !e.shiftKey) ||
        (e.key === "Tab" && noMods && e.shiftKey);
      if (isDown || isUp) {
        e.preventDefault();
        if (ids.length === 0) return;
        // Adopt the mouse-hovered row as the starting point when there's no
        // cursor yet, or when the mouse is actively hovering (moved more
        // recently than the last key press) — so navigation continues from
        // wherever the pointer is rather than a stale keyboard cursor.
        if (cursorIdx === -1 || !suppressHoverRef.current) {
          const hovered = document.querySelector<HTMLElement>(
            "[data-item-id]:hover",
          );
          const hoveredId = hovered?.dataset.itemId;
          if (
            hoveredId &&
            ids.includes(hoveredId) &&
            hoveredId !== currentCursor
          ) {
            setCursor(hoveredId);
            setSuppressHover(true);
            scrollToId(hoveredId);
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
        if (!nextId) return;
        setCursor(nextId);
        setSuppressHover(true);
        scrollToId(nextId);
        return;
      }

      // Enter to open item in side panel
      if (
        e.key === "Enter" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        currentCursor !== null
      ) {
        if (isOverlayOpen()) return;
        e.preventDefault();
        onOpenItem(currentCursor);
        return;
      }

      // Cmd+Shift+Enter to open the item's URL in a new tab
      if (
        e.key === "Enter" &&
        isModKey(e) &&
        e.shiftKey &&
        currentCursor !== null
      ) {
        if (isOverlayOpen()) return;
        e.preventDefault();
        const item = filteredItems.find((i) => i.id === currentCursor);
        if (item?.url && URL.canParse(item.url))
          window.open(item.url, "_blank");
        return;
      }

      // Cmd+Enter to open the item expanded
      if (
        e.key === "Enter" &&
        isModKey(e) &&
        !e.shiftKey &&
        currentCursor !== null
      ) {
        if (isOverlayOpen()) return;
        e.preventDefault();
        onOpenItemExpanded(currentCursor);
        return;
      }
    };
    document.addEventListener("keydown", handleNav);
    return () => document.removeEventListener("keydown", handleNav);
  }, [
    filteredItems,
    getOrderedIds,
    scrollToId,
    setSuppressHover,
    cursorRef,
    setCursor,
    onOpenItem,
    onOpenItemExpanded,
    onExtendSelection,
    onSelectAll,
  ]);

  return {
    suppressHover,
    setSuppressHover,
  };
};
