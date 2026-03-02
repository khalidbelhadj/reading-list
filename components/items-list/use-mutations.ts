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
      store.toggleRead(itemId, read);
    },
    [store],
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
      store.bulkMarkRead(ids, read);
      if (read && !showRead) {
        setSelectedIds(new Set());
        cursorRef.current = null;
      }
    },
    [selectedIds, filteredItems, showRead, store, setSelectedIds, cursorRef],
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
