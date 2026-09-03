import React from "react";

import { type Item } from "@/lib/types";

import { type ReviewMode } from "./review-header";
import {
  itemQueues,
  type QueueCard,
  stackQueue,
  standingQueue,
} from "./review-queues";
import { type ReviewStack } from "./view";

// The pane's queue: frozen on entry (per mode) from the first data that
// arrives (usually the cache, instantly); background refetches don't
// reshuffle a session in progress. Hidden-from-review items are excluded
// from the standing queues, mirroring the server's rules; orphan cards are
// always kept, and an explicit cram surfaces the item's cards regardless.
export const useReviewQueue = ({
  itemId,
  mode,
  stack,
  scopedMode,
  setScopedMode,
  allCards,
  items,
}: {
  itemId?: string;
  mode: ReviewMode;
  stack: ReviewStack | null;
  scopedMode: "due" | "all" | null;
  setScopedMode: (mode: "due" | "all") => void;
  allCards: QueueCard[] | undefined;
  items: Item[] | undefined;
}) => {
  const [queue, setQueue] = React.useState<QueueCard[] | null>(null);
  const [index, setIndex] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const stackId = stack?.id ?? null;
  React.useEffect(() => {
    setQueue(null);
    setIndex(0);
    setRevealed(false);
  }, [mode, scopedMode, stackId]);
  React.useEffect(() => {
    if (queue !== null || !allCards) return;
    if (itemId) {
      const { itemCards, dueCards } = itemQueues(allCards, itemId);
      if (scopedMode === null) {
        // null until the cards arrive: the default is Due when the item has
        // due cards, All (cram) otherwise; re-derive with the resolved mode.
        setScopedMode(dueCards.length > 0 ? "due" : "all");
        return;
      }
      setQueue(scopedMode === "due" ? dueCards : itemCards);
      return;
    }
    if (mode === "topic") {
      if (stack) setQueue(stackQueue(allCards, stack));
      return;
    }
    // Standing queues need the items list too (hidden-from-review lives on
    // the item); freezing before it arrives would skip that exclusion.
    if (!items) return;
    setQueue(standingQueue(allCards, items, mode));
  }, [allCards, items, queue, itemId, mode, scopedMode, setScopedMode, stack]);

  // Move to the next card (after a rating or a skip).
  const advance = React.useCallback(() => {
    setIndex((current) => current + 1);
    setRevealed(false);
  }, []);

  return {
    queue,
    setQueue,
    index,
    revealed,
    setRevealed,
    advance,
    card: queue?.[index] ?? null,
    remaining: queue ? queue.length - index : 0,
    loaded: queue !== null,
  };
};
