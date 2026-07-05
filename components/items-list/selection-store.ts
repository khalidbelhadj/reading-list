import { useSyncExternalStore } from "react";

// Imperative multi-selection store, following the cursor-store pattern: the
// selection changes on every step of a shift+arrow key-repeat, and
// re-rendering the whole list tree per step would drop frames. Only rows
// whose membership actually changed are notified.
//
// The anchor is the fixed end of a shift range — the last row the user
// plain-clicked, cmd-clicked, or started extending from. Shift-click and
// shift+arrows select everything between the anchor and the target.

let selectedIds = new Set<string>();
let anchorId: string | null = null;

const rowListeners = new Map<string, Set<() => void>>();
// Listeners for "does a selection exist at all?" — a coarse subscription that
// fires on every membership change, distinct from the per-row `rowListeners`.
// Drives the Escape dismiss layer, which only cares whether the set is empty.
const emptinessListeners = new Set<() => void>();

const getRowListeners = (id: string): Set<() => void> => {
  let set = rowListeners.get(id);
  if (!set) {
    set = new Set();
    rowListeners.set(id, set);
  }
  return set;
};

const notifyRows = (ids: Iterable<string>) => {
  for (const id of ids) rowListeners.get(id)?.forEach((cb) => cb());
  emptinessListeners.forEach((cb) => cb());
};

export const getSelectedIds = (): ReadonlySet<string> => selectedIds;

export const getSelectionAnchor = (): string | null => anchorId;

export const setSelectionAnchor = (id: string | null): void => {
  anchorId = id;
};

/** Replaces the selection; pass `anchor` to move the shift-range anchor too. */
export const setSelection = (
  ids: Iterable<string>,
  anchor?: string | null,
): void => {
  const next = new Set(ids);
  const changed: string[] = [];
  for (const id of selectedIds) if (!next.has(id)) changed.push(id);
  for (const id of next) if (!selectedIds.has(id)) changed.push(id);
  selectedIds = next;
  if (anchor !== undefined) anchorId = anchor;
  notifyRows(changed);
};

/** Cmd/Ctrl-click: flip one row and make it the new shift-range anchor. */
export const toggleSelected = (id: string): void => {
  const next = new Set(selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds = next;
  anchorId = id;
  notifyRows([id]);
};

export const clearSelection = (): void => setSelection([], null);

/**
 * Drops selected ids that are no longer visible (deleted, filtered out by
 * search/read-visibility, or inside a collapsed section) so bulk actions can
 * never touch rows the user can't see.
 */
export const pruneSelection = (visibleIds: ReadonlySet<string>): void => {
  if (anchorId && !visibleIds.has(anchorId)) anchorId = null;
  if (selectedIds.size === 0) return;
  const kept = [...selectedIds].filter((id) => visibleIds.has(id));
  if (kept.length !== selectedIds.size) setSelection(kept);
};

/** Reactive "is anything selected?" — drives the Escape dismiss layer. */
export const useHasSelection = (): boolean => {
  return useSyncExternalStore(
    (cb) => {
      emptinessListeners.add(cb);
      return () => {
        emptinessListeners.delete(cb);
      };
    },
    () => selectedIds.size > 0,
    () => false,
  );
};

export const useIsSelected = (id: string): boolean => {
  return useSyncExternalStore(
    (cb) => {
      const set = getRowListeners(id);
      set.add(cb);
      return () => {
        set.delete(cb);
        if (set.size === 0) rowListeners.delete(id);
      };
    },
    () => selectedIds.has(id),
    () => false,
  );
};
