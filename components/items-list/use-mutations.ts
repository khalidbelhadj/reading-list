import React from "react";

import { type Item } from "@/lib/types";
import { useItemMutations } from "./use-item-mutations";

export const useItemsMutations = ({
  filteredItems,
  showRead,
  setCursor,
}: {
  filteredItems: Item[];
  showRead: boolean;
  setCursor: (id: string | null) => void;
}) => {
  const { toggleReadMutation, togglePinMutation, deleteMutation } =
    useItemMutations();

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
    (itemId: string) => {
      const idx = filteredItems.findIndex((i) => i.id === itemId);
      const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
      setCursor(nextItem?.id ?? null);
      deleteMutation.mutate(itemId);
    },
    [filteredItems, setCursor, deleteMutation],
  );

  const handleTogglePin = React.useCallback(
    (itemId: string, starred: boolean) => {
      togglePinMutation.mutate({ itemId, starred });
    },
    [togglePinMutation],
  );

  return {
    handleToggleRead,
    handleDeleteSingle,
    handleTogglePin,
  };
};
