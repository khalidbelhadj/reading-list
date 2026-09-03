import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { getAllFlashcards, rateCard } from "@/app/actions";
import { fetchItems } from "@/app/actions";
import { EmptyState } from "@/components/system/empty-state";
import { Skeleton } from "@/components/system/skeleton";
import { notify } from "@/components/system/toast";
import {
  playCardRated,
  playCardSkipped,
  playQueueFinished,
} from "@/lib/sounds";
import { parseCardState, type Rating, schedule } from "@/lib/srs";
import { type Item } from "@/lib/types";

import { RATINGS, ReviewCard, ReviewControls } from "./review-controls";
import { Deck } from "./review-deck";
import { ReviewHeader, type ReviewMode } from "./review-header";
import { type QueueCard } from "./review-queues";
import { ReviewTopic } from "./review-topic";
import { useEditFlashcard } from "./use-edit-flashcard";
import { useReviewQueue } from "./use-review-queue";
import { type ReviewStack } from "./view";

// A stack mixes cards in every state. Rating a card that is due (or brand
// new) is a real review and moves its schedule; rating one that isn't due
// yet is a cram pass and leaves the schedule alone.
const stackRatingAffectsSchedule = (card: QueueCard, now: string) =>
  card.state === "new" || card.due <= now;

// The always-on review, local-first: the due queue is derived from the
// ["all-flashcards"] cache the moment the tab opens — no server round trip in
// the way of the first card (the shell keeps the cache warm). Rating a card
// is a single fire-and-forget scheduling update; there is no session. Review
// one card or all of them, then just leave. "All cards" is the quiet corner
// into the deck. Topic mode asks the review agent for a stack instead.
export const ReviewPane = ({
  itemId,
  stack: initialStack,
  onOpenCardInNotes,
}: {
  itemId?: string;
  // A stack to run instead of a standing queue (from the topic composer or
  // a search result). The pane owns it from here: switching to Due or New
  // drops it.
  stack?: ReviewStack;
  // Jump to this card inside its item's notes.
  onOpenCardInNotes?: (itemId: string, cardId: string) => void;
}) => {
  const queryClient = useQueryClient();
  const [deckOpen, setDeckOpen] = React.useState(false);
  // The standing queues, the topic composer, or a stack; an itemId scopes
  // the pane to that item, with its own choice of just-the-due (scheduled)
  // or everything (cram).
  const [mode, setMode] = React.useState<ReviewMode>(
    initialStack ? "topic" : "due",
  );
  const [stack, setStack] = React.useState<ReviewStack | null>(
    initialStack ?? null,
  );
  const [scopedMode, setScopedMode] = React.useState<"due" | "all" | null>(
    null,
  );
  const { data: allCards } = useQuery({
    queryKey: ["all-flashcards"],
    queryFn: getAllFlashcards,
  });
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  const changeMode = React.useCallback((next: ReviewMode) => {
    if (next !== "topic") setStack(null);
    setMode(next);
  }, []);

  const {
    queue,
    setQueue,
    index,
    revealed,
    setRevealed,
    advance,
    card,
    remaining,
    loaded,
  } = useReviewQueue({
    itemId,
    mode,
    stack,
    scopedMode,
    setScopedMode,
    allCards,
    items,
  });

  // Reconcile locally-advanced due dates with the server's scheduling on the
  // way out of a run.
  const stackId = stack?.id ?? null;
  React.useEffect(() => {
    return () => {
      void queryClient.invalidateQueries({ queryKey: ["all-flashcards"] });
    };
  }, [queryClient, itemId, mode, scopedMode, stackId]);

  const scopeItem = itemId
    ? (items?.find((item) => item.id === itemId) ?? null)
    : null;

  // In-place card editing: keystrokes update the session's copy, and the end
  // of an edit saves through the notes (source of truth) via useEditFlashcard.
  const saveFlashcard = useEditFlashcard();
  // An untouched edit (click in, click out) must not save: the notes rewrite
  // canonicalises the card block, so a no-op commit would still reformat.
  const cardDirtyRef = React.useRef(false);
  const patchCard = React.useCallback(
    (fields: { front?: string; back?: string }) => {
      cardDirtyRef.current = true;
      setQueue((current) =>
        current
          ? current.map((queueCard, cardIndex) =>
              cardIndex === index ? { ...queueCard, ...fields } : queueCard,
            )
          : current,
      );
    },
    [index, setQueue],
  );
  const commitCard = React.useCallback(() => {
    if (!cardDirtyRef.current) return;
    cardDirtyRef.current = false;
    const current = queue?.[index];
    if (current) saveFlashcard(current);
  }, [queue, index, saveFlashcard]);

  const reveal = React.useCallback(() => {
    setRevealed(true);
  }, [setRevealed]);

  // A scoped All-cards run is a cram: it never touches the schedule.
  const rate = React.useCallback(
    (rating: Rating) => {
      if (!card) return;
      const nowIso = new Date().toISOString();
      const affectsSchedule =
        itemId && scopedMode === "all"
          ? false
          : stack
            ? stackRatingAffectsSchedule(card, nowIso)
            : true;
      // Advance instantly; the write is fire-and-forget. The cache mirrors
      // the server's scheduling (same lib/srs) so the sidebar's due count
      // moves with the rating; the unmount reconcile squares any drift.
      if (affectsSchedule) {
        const next = schedule(
          {
            state: parseCardState(card.state),
            interval: card.interval,
            easeFactor: card.easeFactor,
            reps: card.reps,
            lapses: card.lapses,
            due: card.due,
          },
          rating,
          nowIso,
        );
        queryClient.setQueryData<QueueCard[]>(["all-flashcards"], (cached) =>
          cached?.map((cachedCard) =>
            cachedCard.id === card.id ? { ...cachedCard, ...next } : cachedCard,
          ),
        );
      }
      void rateCard({ flashcardId: card.id, rating, affectsSchedule }).catch(
        () => {
          notify({ tone: "error", title: "Could not save the review" });
        },
      );
      // The last card's rating ends the run: the finish chord replaces the
      // tap, since the two smear together.
      if (queue && index === queue.length - 1) playQueueFinished();
      else playCardRated(rating);
      advance();
    },
    [card, itemId, scopedMode, stack, queryClient, advance, queue, index],
  );

  // Skip sets the card aside for this run only; nothing is written. Like a
  // rating, skipping the last card ends the run and gets the finish chord.
  const skip = React.useCallback(() => {
    if (queue && index === queue.length - 1) playQueueFinished();
    else playCardSkipped();
    advance();
  }, [queue, index, advance]);

  // Space reveals, 1-4 rate once revealed, S skips. Typing contexts are left
  // alone.
  React.useEffect(() => {
    if (deckOpen || !card) return;
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          event.target.isContentEditable
        )
          return;
      }
      if (event.key === " " && !revealed) {
        event.preventDefault();
        reveal();
        return;
      }
      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        skip();
        return;
      }
      if (revealed) {
        const rating = RATINGS.find(({ key }) => key === event.key);
        if (rating) {
          event.preventDefault();
          rate(rating.value);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deckOpen, card, revealed, reveal, rate, skip]);

  if (deckOpen) return <Deck onBack={() => setDeckOpen(false)} />;

  const composing = !itemId && mode === "topic" && !stack;
  const emptyDescription = itemId
    ? "This item has no cards."
    : stack
      ? "This stack is done."
      : mode === "new"
        ? "No new cards right now."
        : "No cards are due right now.";

  return (
    <div className="relative flex h-full w-full flex-col px-12 pt-12 pb-6">
      <ReviewHeader
        itemId={itemId}
        scopeItem={scopeItem}
        showCount={loaded && (itemId ? true : !!card)}
        remaining={remaining}
        mode={mode}
        onModeChange={changeMode}
        stackTitle={stack?.title ?? null}
        scopedMode={scopedMode}
        onScopedModeChange={setScopedMode}
        onOpenDeck={() => setDeckOpen(true)}
      />

      {composing ? (
        <ReviewTopic onStart={setStack} />
      ) : !loaded ? (
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center">
          <Skeleton className="h-48 w-full rounded-surface" />
        </div>
      ) : card ? (
        <ReviewCard
          card={card}
          revealed={revealed}
          onReveal={reveal}
          onPatch={patchCard}
          onCommit={commitCard}
          onOpenCardInNotes={onOpenCardInNotes}
        />
      ) : (
        <EmptyState
          className="flex-1 justify-center"
          title="All done"
          description={emptyDescription}
        />
      )}

      <ReviewControls
        active={loaded && !!card && !composing}
        revealed={revealed}
        onSkip={skip}
        onRate={rate}
      />
    </div>
  );
};
