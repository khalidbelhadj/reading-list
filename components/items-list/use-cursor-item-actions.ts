// Cursor-aware single-item actions for ItemsList: wraps the item mutations
// so rows that are about to vanish (delete, mark-read while read items are
// hidden) hand the cursor to the nearest surviving row first.
import React from "react";

import { type Item } from "@/lib/types";

import { useItemMutations } from "./use-item-mutations";

export const useCursorItemActions = ({
  filteredItems,
  showRead,
  setCursor,
}: {
  filteredItems: Item[];
  showRead: boolean;
  setCursor: (id: string | null) => void;
}) => {
  const {
    setItemReadMutation,
    togglePinMutation,
    toggleHiddenFromReviewMutation,
    deleteMutation,
  } = useItemMutations();

  const handleToggleRead = React.useCallback(
    (itemId: string, read: boolean) => {
      if (read && !showRead) {
        const idx = filteredItems.findIndex((i) => i.id === itemId);
        const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
        setCursor(nextItem?.id ?? null);
      }
      setItemReadMutation.mutate({ itemId, read });
    },
    [filteredItems, showRead, setCursor, setItemReadMutation],
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

  const handleToggleHiddenFromReview = React.useCallback(
    (itemId: string, hiddenFromReview: boolean) => {
      toggleHiddenFromReviewMutation.mutate({ itemId, hiddenFromReview });
    },
    [toggleHiddenFromReviewMutation],
  );

  return {
    handleToggleRead,
    handleDeleteSingle,
    handleTogglePin,
    handleToggleHiddenFromReview,
  };
};
