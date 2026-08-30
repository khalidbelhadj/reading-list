// Client-side review queue derivation. The deck lives in the
// ["all-flashcards"] cache (kept warm by the shell), so queues — and the
// sidebar's due count — are computed locally instead of asked of the server.
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { getAllFlashcards } from "@/app/actions";
import { fetchItems } from "@/app/actions";
import { type Item } from "@/lib/types";

// The exact row shape the ["all-flashcards"] cache holds — derived, so the
// cache type can never drift from what the server actually returns.
export type QueueCard = Awaited<ReturnType<typeof getAllFlashcards>>[number];

// Never-studied cards default `due` to their creation time, so a bare
// `due <= now` check would swallow the whole New queue into Due. "Due" means
// scheduled-and-due: studied at least once.
const isDue = (flashcard: QueueCard, now: string) =>
  flashcard.state !== "new" && flashcard.due <= now;

// An item's cards, and the due slice of them, ordered by due date.
export const itemQueues = (allCards: QueueCard[], itemId: string) => {
  const itemCards = allCards.filter((flashcard) => flashcard.itemId === itemId);
  const now = new Date().toISOString();
  const dueCards = itemCards
    .filter((flashcard) => isDue(flashcard, now))
    .sort((a, b) => a.due.localeCompare(b.due));
  return { itemCards, dueCards };
};

// A standing queue (due or new) over the whole deck, excluding cards on
// hidden-from-review items; orphan cards are always kept.
export const standingQueue = (
  allCards: QueueCard[],
  items: Item[] | undefined,
  mode: "due" | "new",
): QueueCard[] => {
  const hidden = new Set(
    (items ?? [])
      .filter((item) => item.hiddenFromReview)
      .map((item) => item.id),
  );
  const now = new Date().toISOString();
  return allCards
    .filter(
      (flashcard) =>
        (mode === "due" ? isDue(flashcard, now) : flashcard.state === "new") &&
        (!flashcard.itemId || !hidden.has(flashcard.itemId)),
    )
    .sort((a, b) => a.due.localeCompare(b.due));
};

// The sidebar's due-count badge, derived from the same caches the review
// pane freezes its queue from — no dedicated server round trip.
export const useDueCount = (): number => {
  const { data: allCards } = useQuery({
    queryKey: ["all-flashcards"],
    queryFn: getAllFlashcards,
  });
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });
  return React.useMemo(
    () => (allCards ? standingQueue(allCards, items, "due").length : 0),
    [allCards, items],
  );
};
