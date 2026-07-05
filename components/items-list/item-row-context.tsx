import React from "react";

/**
 * Row-level state delivered by context instead of drilled through the list tree
 * (GroupedList → VirtualItemGroup → VirtualItemList → ItemList → ItemRow). The
 * intermediate list primitives are pure layout/virtualization and have no use
 * for these values — only the leaf {@link ItemRow} and the suggested strip do.
 *
 * Split into two contexts by change frequency: `ItemActionsContext` holds the
 * stable action callbacks (owned by the items list because they coordinate the
 * cursor, delete dialog, and mutations), while `ItemRowStateContext` holds the
 * volatile presentation state (hover suppression during keyboard nav, per-row
 * typewriter titles). Keeping them apart means an actions-only consumer isn't
 * re-rendered every time hover or a typing title changes.
 *
 * `density` is deliberately NOT here: it lives in global settings, so leaves
 * read it straight from `useSettings` rather than have the list re-broadcast it.
 */
export type SelectModifiers = { meta: boolean; shift: boolean };

export type BulkActions = {
  markRead: (itemIds: string[], read: boolean) => void;
  setPinned: (itemIds: string[], starred: boolean) => void;
  requestDelete: (itemIds: string[]) => void;
};

export type ItemActions = {
  // `modifiers` carries the click's cmd/shift state for multi-select; command
  // sources without a pointer event (suggested cards) omit it — plain select.
  onSelect: (id: string, modifiers?: SelectModifiers) => void;
  onDelete: (id: string) => void;
  onToggleRead: (id: string, read: boolean) => void;
  onTogglePin: (id: string, starred: boolean) => void;
  bulk: BulkActions;
};

type ItemRowState = {
  suppressHover: boolean;
  // Per-item in-progress typewriter titles (keyed by item id), shown after a
  // URL paste while the fetched title types in.
  typingTitles: Record<string, string>;
};

const ItemActionsContext = React.createContext<ItemActions | null>(null);
const ItemRowStateContext = React.createContext<ItemRowState | null>(null);

export const ItemRowProvider = ({
  actions,
  suppressHover,
  typingTitles,
  children,
}: {
  actions: ItemActions;
  suppressHover: boolean;
  typingTitles: Record<string, string>;
  children: React.ReactNode;
}) => {
  const state = React.useMemo(
    () => ({ suppressHover, typingTitles }),
    [suppressHover, typingTitles],
  );
  return (
    <ItemActionsContext.Provider value={actions}>
      <ItemRowStateContext.Provider value={state}>
        {children}
      </ItemRowStateContext.Provider>
    </ItemActionsContext.Provider>
  );
};

export const useItemActions = (): ItemActions => {
  const context = React.useContext(ItemActionsContext);
  if (!context)
    throw new Error("useItemActions must be used within an ItemRowProvider");
  return context;
};

export const useItemRowState = (): ItemRowState => {
  const context = React.useContext(ItemRowStateContext);
  if (!context)
    throw new Error("useItemRowState must be used within an ItemRowProvider");
  return context;
};
