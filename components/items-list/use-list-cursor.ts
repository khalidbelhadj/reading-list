// List cursor for ItemsList: imperative cursor store wiring plus the
// navigation helpers (next/prev, edge jumps, hop-off-removed-rows) and the
// cursor-vs-multi-selection resolution used by bulk shortcuts.
import React from "react";

import { edgeId, hoveredNavId, stepId } from "./cursor-nav";
import { setCursorId } from "./cursor-store";
import { type ScrollToIdOptions } from "./list-nav-registry";
import { getSelectedIds } from "./selection-store";

export const useListCursor = ({
  getOrderedIds,
  scrollToId,
}: {
  getOrderedIds: () => string[];
  scrollToId: (id: string, opts?: ScrollToIdOptions) => void;
}) => {
  // Cursor — driven through an imperative store so only the previously-active
  // and newly-active rows re-render on each move. Keeping a ref mirror lets
  // event handlers read the current id without stale closures.
  const cursorRef = React.useRef<string | null>(null);
  const setCursor = React.useCallback((id: string | null) => {
    cursorRef.current = id;
    setCursorId(id);
  }, []);

  // Cursor navigation driven from inside the search input — arrows / Ctrl+N/P
  // move the cursor without unfocusing, so Enter opens the highlighted item.
  const navigateCursor = React.useCallback(
    (direction: "next" | "prev") => {
      const ids = getOrderedIds();
      if (ids.length === 0) return;
      const current = cursorRef.current;
      // Adoption policy: only when there's no cursor yet — start from the row
      // the mouse is hovering over so the first arrow press picks it up
      // instead of jumping to the list edge.
      if (!current || !ids.includes(current)) {
        const hoveredId = hoveredNavId(ids);
        if (hoveredId) {
          setCursor(hoveredId);
          scrollToId(hoveredId);
          return;
        }
      }
      const nextId = stepId(ids, current, direction);
      if (!nextId) return;
      setCursor(nextId);
      scrollToId(nextId);
    },
    [getOrderedIds, scrollToId, setCursor],
  );

  // Jump the cursor to the first / last rendered row (⌘↑/⌘↓, ⌘⇧</>). Follows
  // search results, filters, and grouping via the shared order.
  const jumpCursor = React.useCallback(
    (edge: "start" | "end") => {
      const nextId = edgeId(getOrderedIds(), edge);
      if (!nextId) return;
      setCursor(nextId);
      scrollToId(nextId);
    },
    [getOrderedIds, scrollToId, setCursor],
  );

  // Before rows vanish (delete, mark-read while read items are hidden) the
  // cursor hops to the nearest surviving row: first forward, then backward.
  const moveCursorOffIds = React.useCallback(
    (removedIds: string[]) => {
      const cursor = cursorRef.current;
      if (!cursor || !removedIds.includes(cursor)) return;
      const ordered = getOrderedIds();
      const removed = new Set(removedIds);
      const cursorIndex = ordered.indexOf(cursor);
      let next: string | null = null;
      for (let i = cursorIndex + 1; i < ordered.length; i++) {
        const id = ordered[i];
        if (id && !removed.has(id)) {
          next = id;
          break;
        }
      }
      if (!next) {
        for (let i = cursorIndex - 1; i >= 0; i--) {
          const id = ordered[i];
          if (id && !removed.has(id)) {
            next = id;
            break;
          }
        }
      }
      setCursor(next);
    },
    [getOrderedIds, setCursor],
  );

  // ⌘⌫ / ⌘⇧M / ⌘⇧P act on the whole selection when the cursor row is part of
  // a multi-selection; otherwise they keep their single-item behavior.
  const selectionForCursor = React.useCallback((): string[] | null => {
    const cursor = cursorRef.current;
    const selected = getSelectedIds();
    return cursor && selected.size > 1 && selected.has(cursor)
      ? [...selected]
      : null;
  }, []);

  return {
    cursorRef,
    setCursor,
    navigateCursor,
    jumpCursor,
    moveCursorOffIds,
    selectionForCursor,
  };
};
