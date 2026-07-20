import React from "react";

import { stepId } from "./cursor-nav";
import {
  clearSelection,
  getSelectedIds,
  getSelectionAnchor,
  setSelection,
  setSelectionAnchor,
  toggleSelected,
} from "./selection-store";

// All rows between two ids in the current visual order (inclusive). With tag
// grouping an item can appear twice; ranges use each id's first occurrence,
// and selection stays id-based so every occurrence highlights together.
const rangeBetween = (ids: string[], a: string, b: string): string[] => {
  const indexA = ids.indexOf(a);
  const indexB = ids.indexOf(b);
  if (indexA === -1 || indexB === -1) {
    return indexB !== -1 ? [b] : indexA !== -1 ? [a] : [];
  }
  const [start, end] = indexA <= indexB ? [indexA, indexB] : [indexB, indexA];
  return ids.slice(start, end + 1);
};

/**
 * Selection gestures for the items list. Selection membership lives in the
 * imperative selection-store; this hook owns the semantics — how clicks with
 * modifiers, shift+arrows, and select-all translate into ranges over the
 * list's current visual order (the nav registry's ordered ids, which span the
 * pinned section and every group, and exclude collapsed sections).
 */
export const useSelection = ({
  getOrderedIds,
  scrollToId,
  cursorRef,
  setCursor,
}: {
  getOrderedIds: () => string[];
  scrollToId: (id: string) => void;
  cursorRef: React.RefObject<string | null>;
  setCursor: (id: string | null) => void;
}) => {
  // Row click with modifiers. Returns true when the caller should proceed to
  // open the item (plain click) — modifier clicks only mutate the selection.
  const applyRowClick = React.useCallback(
    (id: string, modifiers: { meta: boolean; shift: boolean }): boolean => {
      if (modifiers.shift) {
        // Range from the anchor (last plain/cmd-clicked row); fall back to
        // the cursor, then to the clicked row alone.
        const ids = getOrderedIds();
        const anchor = getSelectionAnchor() ?? cursorRef.current ?? id;
        setSelection(rangeBetween(ids, anchor, id), anchor);
        setCursor(id);
        return false;
      }
      if (modifiers.meta) {
        toggleSelected(id);
        setCursor(id);
        return false;
      }
      // Plain click: collapse any selection and remember the row as the
      // anchor so a following shift-click ranges from here.
      if (getSelectedIds().size > 0) clearSelection();
      setSelectionAnchor(id);
      return true;
    },
    [getOrderedIds, cursorRef, setCursor],
  );

  // Shift+ArrowDown/Up: move the cursor one row and select the range between
  // it and the anchor — extending when moving away, shrinking when moving
  // back toward it.
  const extendSelection = React.useCallback(
    (direction: "next" | "prev") => {
      const ids = getOrderedIds();
      if (ids.length === 0) return;
      const current = cursorRef.current;
      // No hover adoption here (unlike cursor nav): shift+arrows always range
      // from the keyboard cursor / anchor, never from the mouse position.
      const nextId = stepId(ids, current, direction);
      if (!nextId) return;
      const storedAnchor = getSelectionAnchor();
      const anchor =
        storedAnchor && ids.includes(storedAnchor)
          ? storedAnchor
          : current && ids.includes(current)
            ? current
            : nextId;
      setSelection(rangeBetween(ids, anchor, nextId), anchor);
      setCursor(nextId);
      scrollToId(nextId);
    },
    [getOrderedIds, scrollToId, cursorRef, setCursor],
  );

  const selectAll = React.useCallback(() => {
    const ids = getOrderedIds();
    if (ids.length === 0) return;
    setSelection(ids, getSelectionAnchor() ?? ids[0]);
  }, [getOrderedIds]);

  return { applyRowClick, extendSelection, selectAll };
};
