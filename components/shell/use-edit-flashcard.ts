import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { updateFlashcard, updateItem } from "@/app/actions";
import { type QueueCard } from "@/components/shell/review-queues";
import { notify } from "@/components/system/toast";
import { replaceCardInNotes } from "@/lib/card-parse";
import { type Item } from "@/lib/types";

// The slice of a cached card an edit actually touches.
export type EditableFlashcard = Pick<
  QueueCard,
  "id" | "itemId" | "front" | "back"
>;

/**
 * Saving a flashcard edit, from review or the deck. Notes are the source of
 * truth for inline cards, so a card that belongs to an item is saved by
 * rewriting its `<card>` block inside the item's notes (replaceCardInNotes,
 * fence-safe and surgical) and updating the item — the existing notes→DB sync
 * then updates the flashcard row. Editing the row directly would be silently
 * reverted by the next notes save. Orphan cards (no item) have no notes to
 * stay true to, so they update the row directly. Optimistic on both paths;
 * a failure refetches the truth and shows an error card.
 */
export const useEditFlashcard = () => {
  const queryClient = useQueryClient();

  const rollback = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["items"] });
    void queryClient.invalidateQueries({ queryKey: ["all-flashcards"] });
    notify({ tone: "error", title: "Could not save the card" });
  }, [queryClient]);

  const { mutate: saveNotes } = useMutation({
    mutationFn: (args: { itemId: string; notes: string }) =>
      updateItem(args.itemId, { notes: args.notes }),
    onError: rollback,
  });

  const { mutate: saveRow } = useMutation({
    mutationFn: (args: { id: string; front: string; back: string }) =>
      updateFlashcard(args.id, { front: args.front, back: args.back }),
    onError: rollback,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["all-flashcards"] }),
  });

  return React.useCallback(
    (card: EditableFlashcard) => {
      // Keep the deck cache in step regardless of path.
      queryClient.setQueryData<QueueCard[]>(["all-flashcards"], (old) =>
        old?.map((cached) =>
          cached.id === card.id
            ? { ...cached, front: card.front, back: card.back }
            : cached,
        ),
      );

      if (card.itemId) {
        const item = queryClient
          .getQueryData<Item[]>(["items"])
          ?.find((cached) => cached.id === card.itemId);
        const rewritten =
          item?.notes != null
            ? replaceCardInNotes(item.notes, card.id, card.front, card.back)
            : null;
        if (rewritten !== null && card.itemId) {
          queryClient.setQueryData<Item[]>(["items"], (old) =>
            old?.map((cached) =>
              cached.id === card.itemId
                ? { ...cached, notes: rewritten }
                : cached,
            ),
          );
          saveNotes({ itemId: card.itemId, notes: rewritten });
          return;
        }
        // The card's id isn't in the notes (drift, or notes not cached) —
        // fall through to the row update rather than losing the edit.
      }
      saveRow({ id: card.id, front: card.front, back: card.back });
    },
    [queryClient, saveNotes, saveRow],
  );
};
