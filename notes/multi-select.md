# Multi-select in the items list

Selection membership lives in `components/items-list/selection-store.ts` — an
imperative store like cursor-store (per-row `useSyncExternalStore`
subscriptions), because shift+arrow key-repeat changes the selection every
step and re-rendering the whole list would drop frames. The gesture semantics
(anchored shift ranges, cmd-click toggles, select-all) live in
`use-selection.ts` and operate over the nav registry's ordered ids, so ranges
span the pinned section and every group, follow search order, and skip
collapsed sections.

Interactions:

- Plain click: clears selection, sets the shift anchor, opens the item.
- Cmd/Ctrl-click: toggles the row, no open. (Ctrl-click on macOS is the
  native context-menu gesture and never reaches the click handler — that's
  fine, cmd is the mac toggle.)
- Shift-click / Shift+↑↓: anchored range — extends away from the anchor,
  shrinks moving back. ⌘A selects all visible rows. Esc clears the selection:
  the selection is its own dismiss-stack layer (active while non-empty, driven
  by `useHasSelection`), so it interleaves with the panel/search by recency —
  a selection made after opening the panel is cleared before the panel closes.
  Once no selection remains, the empty-stack fallback clears the cursor.
- ⌘⌫ / ⌘⇧M / ⌘⇧P act on the whole selection when the cursor row is part of a
  multi-selection.

Edge cases handled:

- A prune effect drops selected ids that leave the visible set (deleted in
  any window, filtered out, or hidden by collapsing the pinned section), so
  bulk actions can never touch rows the user can't see. Registry ids — not
  filteredItems — are the source of truth so collapse state counts.
- With tag grouping an item renders in multiple groups; selection is id-based
  (all occurrences highlight), ranges use first occurrences.
- Bulk schemas cap at 100 ids per call — use-bulk-mutations chunks requests.
- Before rows vanish (bulk delete, mark-read while read items are hidden) the
  cursor hops to the nearest surviving row.

Bulk context menu: right-clicking a row that's part of a ≥2 selection swaps
the single-item menu for `BulkMenuItems` (open URLs, smart read/unread and
pin/unpin, copy IDs/URLs/titles, delete with confirm). The
decision is snapshotted at menu-open time (`bulkMenuIds` in ItemRow) so no
row needs a reactive selection-count subscription; right-clicking an
*unselected* row keeps the selection and shows the normal single-item menu.
Bulk mutations are optimistic (mirroring use-item-mutations) and cross-window
sync rides the existing local-sync invalidation mirror for free.

Gotcha: base-ui `Menu.GroupLabel` (`DropdownMenuLabel`) throws unless wrapped
in `Menu.Group` (`DropdownMenuGroup`) — a bare label in menu content crashes
the whole route to the error boundary.
