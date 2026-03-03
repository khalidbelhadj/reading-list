import React from "react";
import { useStore } from "@/lib/store";
import { type Item, isReadingListItem } from "@/lib/types";

export function useItemsMutations({
  filteredItems,
  selectedIds,
  setSelectedIds,
  setEditingId,
  setBulkMode,
  showRead,
  tabType,
  cursorRef,
  anchorRef,
}: {
  filteredItems: Item[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  setBulkMode: React.Dispatch<React.SetStateAction<boolean>>;
  showRead: boolean;
  tabType: string;
  cursorRef: React.MutableRefObject<string | null>;
  anchorRef: React.MutableRefObject<string | null>;
}) {
  const store = useStore();

  const handleReorder = React.useCallback(
    (itemId: string, type: string, newPosition: number) => {
      store.reorderItem(itemId, type, newPosition);
    },
    [store],
  );

  const handleToggleRead = React.useCallback(
    (itemId: string, read: boolean) => {
      // When marking as read and read items are hidden, select the next item
      if (read && !showRead) {
        const idx = filteredItems.findIndex((i) => i.id === itemId);
        const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
        if (nextItem) {
          setSelectedIds(new Set([nextItem.id]));
          cursorRef.current = nextItem.id;
          anchorRef.current = nextItem.id;
        } else {
          setSelectedIds(new Set());
          cursorRef.current = null;
        }
      }
      store.toggleRead(itemId, read);
    },
    [store, showRead, filteredItems, setSelectedIds, cursorRef, anchorRef],
  );

  const handleDeleteSingle = React.useCallback(
    (itemId: string) => {
      const idx = filteredItems.findIndex((i) => i.id === itemId);
      const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
      store.deleteItem(itemId);
      setEditingId(null);
      if (nextItem) {
        setSelectedIds(new Set([nextItem.id]));
        cursorRef.current = nextItem.id;
        anchorRef.current = nextItem.id;
      } else {
        setSelectedIds(new Set());
        cursorRef.current = null;
      }
    },
    [store, filteredItems, setEditingId, setSelectedIds, cursorRef, anchorRef],
  );

  const handleBulkDelete = React.useCallback(() => {
    const ids = Array.from(selectedIds);
    store.bulkDelete(ids);
    setSelectedIds(new Set());
    setBulkMode(false);
  }, [selectedIds, store, setSelectedIds, setBulkMode]);

  const handleBulkMarkRead = React.useCallback(
    (read: boolean) => {
      const ids = Array.from(selectedIds).filter((id) => {
        const item = filteredItems.find((i) => i.id === id);
        return item && isReadingListItem(item);
      });
      if (read && !showRead) {
        const idsSet = new Set(ids);
        // Find the first item after the selection that won't be hidden
        const lastIdx = filteredItems.reduce((max, item, idx) => idsSet.has(item.id) ? Math.max(max, idx) : max, -1);
        const firstIdx = filteredItems.findIndex((i) => idsSet.has(i.id));
        const nextItem = filteredItems.slice(lastIdx + 1).find((i) => !idsSet.has(i.id))
          ?? (firstIdx > 0 ? filteredItems[firstIdx - 1] : undefined);
        if (nextItem) {
          setSelectedIds(new Set([nextItem.id]));
          cursorRef.current = nextItem.id;
          anchorRef.current = nextItem.id;
        } else {
          setSelectedIds(new Set());
          cursorRef.current = null;
        }
        setBulkMode(false);
      }
      store.bulkMarkRead(ids, read);
    },
    [selectedIds, filteredItems, showRead, store, setSelectedIds, cursorRef, anchorRef, setBulkMode],
  );

  const handleBulkMove = React.useCallback(() => {
    const ids = Array.from(selectedIds);
    const targetType = tabType === "reading-list" ? "bookmark" : "reading-list";
    store.bulkMove(ids, targetType);
    setSelectedIds(new Set());
    setBulkMode(false);
  }, [selectedIds, tabType, store, setSelectedIds, setBulkMode]);

  return {
    handleReorder,
    handleToggleRead,
    handleDeleteSingle,
    handleBulkDelete,
    handleBulkMarkRead,
    handleBulkMove,
  };
}
