import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  reorderItem,
  toggleRead,
  deleteItem,
} from "@/app/actions";
import { type Item } from "@/lib/types";
import { useInvalidateItems } from "./use-invalidate-items";

export const useItemsMutations = ({
  filteredItems,
  setSelectedId,
  setEditingId,
  showRead,
  setCursor,
}: {
  filteredItems: Item[];
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  showRead: boolean;
  setCursor: (id: string | null) => void;
}) => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateItems();

  const reorderMutation = useMutation({
    mutationFn: ({ itemId, newPosition }: { itemId: string; newPosition: number }) =>
      reorderItem(itemId, newPosition),
    onSuccess: invalidate,
  });

  const toggleReadMutation = useMutation({
    mutationFn: ({ itemId, read }: { itemId: string; read: boolean }) =>
      toggleRead(itemId, read),
    onMutate: async ({ itemId, read }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueryData<Item[]>(["items"]);
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        (old ?? []).map((item) =>
          item.id === itemId
            ? { ...item, read, readAt: read ? new Date().toISOString() : null, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["items"], context.previous);
      }
    },
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onSuccess: invalidate,
  });

  const handleReorder = React.useCallback(
    (itemId: string, newPosition: number) => {
      reorderMutation.mutate({ itemId, newPosition });
    },
    [reorderMutation],
  );

  const handleToggleRead = React.useCallback(
    (itemId: string, read: boolean) => {
      if (read && !showRead) {
        const idx = filteredItems.findIndex((i) => i.id === itemId);
        const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
        if (nextItem) {
          setSelectedId(nextItem.id);
          setCursor(nextItem.id);
        } else {
          setSelectedId(null);
          setCursor(null);
        }
      }
      toggleReadMutation.mutate({ itemId, read });
    },
    [filteredItems, showRead, setSelectedId, setCursor, toggleReadMutation],
  );

  const handleDeleteSingle = React.useCallback(
    async (itemId: string) => {
      await deleteMutation.mutateAsync(itemId);
      const idx = filteredItems.findIndex((i) => i.id === itemId);
      const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
      setEditingId(null);
      if (nextItem) {
        setSelectedId(nextItem.id);
        setCursor(nextItem.id);
      } else {
        setSelectedId(null);
        setCursor(null);
      }
    },
    [filteredItems, setEditingId, setSelectedId, setCursor, deleteMutation],
  );

  return {
    handleReorder,
    handleToggleRead,
    handleDeleteSingle,
  };
};
