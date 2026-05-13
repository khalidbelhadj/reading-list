import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  reorderItem,
  toggleRead,
  deleteItem,
  updateItem,
} from "@/app/actions";
import { type Item } from "@/lib/types";
import { useInvalidateItems } from "./use-invalidate-items";

export const useItemsMutations = ({
  filteredItems,
  showRead,
  setCursor,
}: {
  filteredItems: Item[];
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
        setCursor(nextItem?.id ?? null);
      }
      toggleReadMutation.mutate({ itemId, read });
    },
    [filteredItems, showRead, setCursor, toggleReadMutation],
  );

  const handleDeleteSingle = React.useCallback(
    async (itemId: string) => {
      await deleteMutation.mutateAsync(itemId);
      const idx = filteredItems.findIndex((i) => i.id === itemId);
      const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
      setCursor(nextItem?.id ?? null);
    },
    [filteredItems, setCursor, deleteMutation],
  );

  const togglePinMutation = useMutation({
    mutationFn: ({ itemId, starred }: { itemId: string; starred: boolean }) =>
      updateItem(itemId, { starred }),
    onMutate: async ({ itemId, starred }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueryData<Item[]>(["items"]);
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        (old ?? []).map((item) =>
          item.id === itemId ? { ...item, starred } : item,
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

  const handleTogglePin = React.useCallback(
    (itemId: string, starred: boolean) => {
      togglePinMutation.mutate({ itemId, starred });
    },
    [togglePinMutation],
  );

  return {
    handleReorder,
    handleToggleRead,
    handleDeleteSingle,
    handleTogglePin,
  };
};
