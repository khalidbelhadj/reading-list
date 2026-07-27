import React from "react";
import { toast } from "sonner";

import { setDismissFallback } from "@/lib/dismiss-stack";
import { isOverlayOpen, isTypingContext } from "@/lib/input-context";
import { dispatchPanelCommand } from "@/lib/panel-events";
import {
  matchesChord,
  SHORTCUT_ENTRIES,
  type ShortcutActionId,
  type ShortcutGate,
} from "@/lib/shortcuts";
import { type Item } from "@/lib/types";

import { edgeId, hoveredNavId, stepId } from "./cursor-nav";

// Keyboard shortcuts for the items list. The bindings themselves — chords,
// gating regime, and the `?` dialog metadata — live declaratively in
// SHORTCUT_ENTRIES (lib/shortcuts.ts); this hook supplies the action handlers
// and runs the single keydown dispatcher over that table. Add or change a
// binding in the table, add its handler here — the dialog derives from the
// same table so it can't drift.

type ActionHandlers = Record<ShortcutActionId, (e: KeyboardEvent) => void>;

const gatePasses = (gate: ShortcutGate, e: KeyboardEvent): boolean => {
  switch (gate) {
    case "notTyping":
      return !isTypingContext(e);
    case "noOverlay":
      return !isOverlayOpen();
    case "notTypingNoOverlay":
      return !isTypingContext(e) && !isOverlayOpen();
  }
};

// When focus rests on a button/link (e.g. a delete dialog just restored focus
// to its trigger, or the toolbar is focused), bindings marked
// skipOnInteractive keep the key's native meaning.
const isInteractiveTarget = (e: KeyboardEvent): boolean => {
  const tag = (e.target as HTMLElement | null)?.tagName;
  return tag === "BUTTON" || tag === "A";
};

const dispatchShortcut = (e: KeyboardEvent, handlers: ActionHandlers): void => {
  for (const entry of SHORTCUT_ENTRIES) {
    if (!entry.action) continue;
    if (!entry.chords.some((chord) => matchesChord(e, chord))) continue;
    if (!gatePasses(entry.gate, e)) continue;
    if (entry.skipOnInteractive && isInteractiveTarget(e)) continue;
    handlers[entry.action](e);
    return;
  }
};

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

  // ↑/↓, Ctrl+N/P, j/k — move the cursor one row. Adoption policy: start from
  // the mouse-hovered row when there's no cursor yet, or when the mouse is
  // actively hovering (moved more recently than the last key press) — so
  // navigation continues from wherever the pointer is rather than a stale
  // keyboard cursor.
  const moveCursor = React.useCallback(
    (e: KeyboardEvent, direction: "next" | "prev") => {
      e.preventDefault();
      const ids = getOrderedIds();
      if (ids.length === 0) return;
      const current = cursorRef.current;
      const hasCursor = current !== null && ids.includes(current);
      if (!hasCursor || !suppressHoverRef.current) {
        const hoveredId = hoveredNavId(ids);
        if (hoveredId && hoveredId !== current) {
          setCursor(hoveredId);
          setSuppressHover(true);
          scrollToId(hoveredId);
          return;
        }
      }
      const nextId = stepId(ids, current, direction);
      if (!nextId) return;
      setCursor(nextId);
      setSuppressHover(true);
      scrollToId(nextId);
    },
    [getOrderedIds, cursorRef, setCursor, scrollToId],
  );

  // ⌘↑/⌘↓, ⌘⇧</> — jump to the first / last rendered row. Works on whatever's
  // currently rendered, so it follows search results, filters, and grouping.
  const jumpCursor = React.useCallback(
    (e: KeyboardEvent, edge: "start" | "end") => {
      e.preventDefault();
      const nextId = edgeId(getOrderedIds(), edge);
      if (!nextId) return;
      setCursor(nextId);
      setSuppressHover(true);
      scrollToId(nextId);
    },
    [getOrderedIds, setCursor, scrollToId],
  );

  // Enter variants act on the cursor row; without a cursor they fall through
  // to the key's native behavior (no preventDefault).
  const withCursor = React.useCallback(
    (e: KeyboardEvent, run: (cursorId: string) => void) => {
      const cursorId = cursorRef.current;
      if (cursorId === null) return;
      e.preventDefault();
      run(cursorId);
    },
    [cursorRef],
  );

  // Tab — move focus into the selected item's notes editor. Shift+Tab is
  // swallowed so it does nothing (rather than walking native focus).
  const focusNotes = React.useCallback((e: KeyboardEvent) => {
    if (e.shiftKey) {
      e.preventDefault();
      return;
    }
    const editor = document.querySelector<HTMLElement>(
      "[data-detail-panel] .ProseMirror",
    );
    if (!editor) return;
    e.preventDefault();
    editor.focus();
  }, []);

  const simple = (run: () => void) => (e: KeyboardEvent) => {
    e.preventDefault();
    run();
  };

  const handlers: ActionHandlers = {
    showShortcuts: simple(onShowShortcuts),
    openSearch: simple(onSearchOpen),
    // ⌘K — focus search; if an item is in full view, pop it back to side view
    // so the list (and search box) are visible.
    focusSearch: simple(() => {
      dispatchPanelCommand("peek");
      onSearchOpen();
    }),
    openNew: simple(onOpenNew),
    cursorDown: (e) => moveCursor(e, "next"),
    cursorUp: (e) => moveCursor(e, "prev"),
    jumpStart: (e) => jumpCursor(e, "start"),
    jumpEnd: (e) => jumpCursor(e, "end"),
    openItem: (e) => withCursor(e, onOpenItem),
    openItemExpanded: (e) => withCursor(e, onOpenItemExpanded),
    openItemUrl: (e) =>
      withCursor(e, (cursorId) => {
        const item = filteredItems.find((i) => i.id === cursorId);
        if (item?.url && URL.canParse(item.url))
          window.open(item.url, "_blank");
      }),
    extendSelectionDown: simple(() => {
      onExtendSelection("next");
      setSuppressHover(true);
    }),
    extendSelectionUp: simple(() => {
      onExtendSelection("prev");
      setSuppressHover(true);
    }),
    selectAll: simple(onSelectAll),
    focusNotes,
    toggleReadCursor: simple(onToggleReadCursor),
    togglePinCursor: simple(onTogglePinCursor),
    chatCursor: simple(onChatCursor),
    deleteCursor: (e) => withCursor(e, () => onRequestDelete?.()),
    toggleTagFilter: simple(() => setTagsOpen((v) => !v)),
    toggleShowRead: simple(() => setShowRead((v) => !v)),
    toggleDensity: simple(onToggleDensity),
    toggleTheme: simple(onToggleTheme),
    panelExpand: simple(() => dispatchPanelCommand("expand")),
    panelCollapse: simple(() => dispatchPanelCommand("collapse")),
  };

  // Ref mirror so the single document listener binds once and always sees the
  // latest handler closures.
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) =>
      dispatchShortcut(e, handlersRef.current);
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    suppressHover,
    setSuppressHover,
  };
};
