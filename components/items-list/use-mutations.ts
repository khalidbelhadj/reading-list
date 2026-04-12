import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  reorderItem,
  toggleRead,
  deleteItem,
} from "@/app/actions";
import { type Item } from "@/lib/types";

export const useItemsMutations = ({
  filteredItems,
  setSelectedIds,
  setEditingId,
  showRead,
  setCursor,
}: {
  filteredItems: Item[];
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  showRead: boolean;
  setCursor: (id: string | null) => void;
}) => {
  const queryClient = useQueryClient();
  const invalidate = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["items"] }),
    [queryClient],
  );

  const reorderMutation = useMutation({
    mutationFn: ({ itemId, type, newPosition }: { itemId: string; type: string; newPosition: number }) =>
      reorderItem(itemId, type, newPosition),
    onSuccess: invalidate,
  });

  const toggleReadMutation = useMutation({
    mutationFn: ({ itemId, read }: { itemId: string; read: boolean }) =>
      toggleRead(itemId, read),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onSuccess: invalidate,
  });

  const handleReorder = React.useCallback(
    (itemId: string, type: string, newPosition: number) => {
      reorderMutation.mutate({ itemId, type, newPosition });
    },
    [reorderMutation],
  );

  const handleToggleRead = React.useCallback(
    (itemId: string, read: boolean) => {
      if (read && !showRead) {
        const idx = filteredItems.findIndex((i) => i.id === itemId);
        const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
        if (nextItem) {
          setSelectedIds(new Set([nextItem.id]));
          setCursor(nextItem.id);
        } else {
          setSelectedIds(new Set());
          setCursor(null);
        }
      }
      toggleReadMutation.mutate({ itemId, read });
    },
    [filteredItems, showRead, setSelectedIds, setCursor, toggleReadMutation],
  );

  const handleDeleteSingle = React.useCallback(
    (itemId: string) => {
      const idx = filteredItems.findIndex((i) => i.id === itemId);
      const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
      setEditingId(null);
      if (nextItem) {
        setSelectedIds(new Set([nextItem.id]));
        setCursor(nextItem.id);
      } else {
        setSelectedIds(new Set());
        setCursor(null);
      }
      deleteMutation.mutate(itemId);
    },
    [filteredItems, setEditingId, setSelectedIds, setCursor, deleteMutation],
  );

  return {
    handleReorder,
    handleToggleRead,
    handleDeleteSingle,
  };
};
