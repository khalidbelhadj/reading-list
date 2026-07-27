// Shared cursor-stepping MECHANICS for the items list. Three consumers step
// the cursor through the ordered ids (use-list-cursor's navigateCursor,
// use-keyboard-navigation's ↑/↓ handler, use-selection's extendSelection) and
// two jump to an edge — but each keeps its own *policy* (when to adopt the
// hovered row, whether to suppress hover) at the call site. Only the
// mechanics live here.

/**
 * The id one step from `current` in `direction`, clamped to the list edges.
 * With no current cursor (null or not in `ids`), falls back to the first row
 * for "next" and the last row for "prev". Returns null for an empty list.
 */
export const stepId = (
  ids: string[],
  current: string | null,
  direction: "next" | "prev",
): string | null => {
  const index = current ? ids.indexOf(current) : -1;
  if (index === -1) return edgeId(ids, direction === "next" ? "start" : "end");
  const nextIndex =
    direction === "next"
      ? Math.min(index + 1, ids.length - 1)
      : Math.max(index - 1, 0);
  return ids[nextIndex] ?? null;
};

/** First / last rendered row id, or null for an empty list. */
export const edgeId = (ids: string[], edge: "start" | "end"): string | null =>
  (edge === "start" ? ids[0] : ids[ids.length - 1]) ?? null;

/**
 * The row the mouse is currently hovering, if it's part of the ordered ids.
 * Callers decide *when* hover adoption applies; this only finds the row.
 */
export const hoveredNavId = (ids: string[]): string | null => {
  const hovered = document.querySelector<HTMLElement>("[data-item-id]:hover");
  const hoveredId = hovered?.dataset.itemId;
  return hoveredId && ids.includes(hoveredId) ? hoveredId : null;
};
