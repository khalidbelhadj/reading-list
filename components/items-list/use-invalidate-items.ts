import React from "react";
import { useQueryClient } from "@tanstack/react-query";

export const useInvalidateItems = () => {
  const queryClient = useQueryClient();
  return React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["items"] }),
    [queryClient],
  );
};

/**
 * Invalidates every cache that an item's flashcards feed into. Use after any
 * mutation that can change an item's cards server-side (deleting the item,
 * saving notes that reconcile inline flashcards) so card lists and the due/new
 * review counts stay in sync.
 */
export const useInvalidateItemFlashcards = () => {
  const queryClient = useQueryClient();
  return React.useCallback(
    (itemId: string) => {
      queryClient.invalidateQueries({ queryKey: ["all-flashcards"] });
      queryClient.invalidateQueries({ queryKey: ["flashcards", itemId] });
      queryClient.invalidateQueries({ queryKey: ["review-status"] });
      queryClient.invalidateQueries({
        queryKey: ["item-review-status", itemId],
      });
    },
    [queryClient],
  );
};
