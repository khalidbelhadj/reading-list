import React from "react";
import { useMutation, type QueryClient } from "@tanstack/react-query";

import {
  bulkDeleteItems,
  bulkMarkRead,
  bulkMoveItems,
  deleteItem,
  reorderItem,
  toggleRead,
} from "@/app/actions";
import { type Item, isReadingListItem } from "@/lib/types";

export function useItemsMutations({
  queryClient,
  filteredItems,
  selectedIds,
  setSelectedIds,
  setEditingId,
  setBulkMode,
  setPendingActions,
  showRead,
  tabType,
  cursorRef,
  anchorRef,
}: {
  queryClient: QueryClient;
  filteredItems: Item[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  setBulkMode: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingActions: React.Dispatch<React.SetStateAction<number>>;
  showRead: boolean;
  tabType: string;
  cursorRef: React.MutableRefObject<string | null>;
  anchorRef: React.MutableRefObject<string | null>;
}) {
  const reorderMutation = useMutation({
    mutationFn: async ({
      itemId,
      type,
      newPosition,
    }: {
      itemId: string;
      type: string;
      newPosition: number;
    }) => {
      await reorderItem(itemId, type, newPosition);
    },
    onMutate: async ({ itemId, newPosition }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previousItems = queryClient.getQueryData<Item[]>(["items"]);

      queryClient.setQueryData<Item[]>(["items"], (old) => {
        if (!old) return old;
        const allItems = old.map((i) => ({ ...i }));
        const item = allItems.find((i) => i.id === itemId);
        if (!item) return allItems;

        const typeItems = allItems
          .filter((i) => i.type === item.type)
          .sort((a, b) => a.position - b.position);

        const currentIndex = typeItems.findIndex((i) => i.id === itemId);
        const [moved] = typeItems.splice(currentIndex, 1);
        typeItems.splice(newPosition, 0, moved);
        typeItems.forEach((ti, idx) => {
          ti.position = idx;
        });

        return allItems;
      });

      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["items"], context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const toggleReadMutation = useMutation({
    mutationFn: async ({ itemId, read }: { itemId: string; read: boolean }) => {
      await toggleRead(itemId, read);
    },
    onMutate: async ({ itemId, read }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previousItems = queryClient.getQueryData<Item[]>(["items"]);

      queryClient.setQueryData<Item[]>(["items"], (old) => {
        if (!old) return old;
        return old.map((i) => (i.id === itemId ? { ...i, read } : i));
      });

      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["items"], context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const handleDeleteSingle = React.useCallback(
    async (itemId: string) => {
      const idx = filteredItems.findIndex((i) => i.id === itemId);
      const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        old ? old.filter((i) => i.id !== itemId) : old,
      );
      setEditingId(null);
      if (nextItem) {
        setSelectedIds(new Set([nextItem.id]));
        cursorRef.current = nextItem.id;
        anchorRef.current = nextItem.id;
      } else {
        setSelectedIds(new Set());
        cursorRef.current = null;
      }
      setPendingActions((n) => n + 1);
      deleteItem(itemId).then(() => queryClient.invalidateQueries({ queryKey: ["items"] })).finally(() => setPendingActions((n) => n - 1));
    },
    [queryClient, filteredItems, setEditingId, setSelectedIds, setPendingActions, cursorRef, anchorRef],
  );

  const handleBulkDelete = React.useCallback(async () => {
    const ids = Array.from(selectedIds);
    queryClient.setQueryData<Item[]>(["items"], (old) =>
      old ? old.filter((i) => !selectedIds.has(i.id)) : old,
    );
    setSelectedIds(new Set());
    setBulkMode(false);
    setPendingActions((n) => n + 1);
    bulkDeleteItems(ids).then(() => queryClient.invalidateQueries({ queryKey: ["items"] })).finally(() => setPendingActions((n) => n - 1));
  }, [selectedIds, queryClient, setSelectedIds, setBulkMode, setPendingActions]);

  const handleBulkMarkRead = React.useCallback(async (read: boolean) => {
    const ids = Array.from(selectedIds);
    queryClient.setQueryData<Item[]>(["items"], (old) =>
      old ? old.map((i) =>
        selectedIds.has(i.id) && isReadingListItem(i) ? { ...i, read } : i
      ) : old,
    );
    if (read && !showRead) {
      setSelectedIds(new Set());
      cursorRef.current = null;
    }
    setPendingActions((n) => n + 1);
    bulkMarkRead(ids, read).then(() => queryClient.invalidateQueries({ queryKey: ["items"] })).finally(() => setPendingActions((n) => n - 1));
  }, [selectedIds, showRead, queryClient, setSelectedIds, setPendingActions, cursorRef]);

  const handleBulkMove = React.useCallback(async () => {
    const ids = Array.from(selectedIds);
    const targetType = tabType === "reading-list" ? "bookmark" : "reading-list";
    queryClient.setQueryData<Item[]>(["items"], (old) =>
      old ? old.filter((i) => !selectedIds.has(i.id)) : old,
    );
    setSelectedIds(new Set());
    setBulkMode(false);
    setPendingActions((n) => n + 1);
    bulkMoveItems(ids, targetType).then(() => queryClient.invalidateQueries({ queryKey: ["items"] })).finally(() => setPendingActions((n) => n - 1));
  }, [selectedIds, tabType, queryClient, setSelectedIds, setBulkMode, setPendingActions]);

  return {
    reorderMutation,
    toggleReadMutation,
    handleDeleteSingle,
    handleBulkDelete,
    handleBulkMarkRead,
    handleBulkMove,
  };
}
