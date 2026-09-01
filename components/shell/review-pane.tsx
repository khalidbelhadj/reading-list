import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { getAllFlashcards, rateCard } from "@/app/actions";
import { fetchItems } from "@/app/actions";
import { Favicon } from "@/components/app/favicon";
import { Flashcard } from "@/components/app/flashcard";
import { Button } from "@/components/system/button";
import { ButtonGroup } from "@/components/system/button-group";
import { EmptyState } from "@/components/system/empty-state";
import { Kbd } from "@/components/system/kbd";
import { TextLink } from "@/components/system/link";
import { Select } from "@/components/system/select";
import { Skeleton } from "@/components/system/skeleton";
import { notify } from "@/components/system/toast";
import { Tooltip } from "@/components/system/tooltip";
import { parseCardState, type Rating, schedule } from "@/lib/srs";
import { type Item } from "@/lib/types";

import { Deck } from "./review-deck";
import { itemQueues, type QueueCard, standingQueue } from "./review-queues";
import { useEditFlashcard } from "./use-edit-flashcard";

const RATINGS: Array<{ value: Rating; label: string; key: string }> = [
  { value: "again", label: "Again", key: "1" },
  { value: "hard", label: "Hard", key: "2" },
  { value: "good", label: "Good", key: "3" },
  { value: "easy", label: "Easy", key: "4" },
];

// The page furniture pinned to the pane's corners: the Due/New switch (or
// the cram label when item-scoped) with the count top-left, the deck door
// top-right.
const ReviewHeader = ({
  itemId,
  scopeItem,
  showCount,
  remaining,
  mode,
  onModeChange,
  scopedMode,
  onScopedModeChange,
  onOpenDeck,
}: {
  itemId?: string;
  scopeItem: { title: string; url: string; faviconUrl?: string | null } | null;
  showCount: boolean;
  remaining: number;
  mode: "due" | "new";
  onModeChange: (mode: "due" | "new") => void;
  scopedMode: "due" | "all" | null;
  onScopedModeChange: (mode: "due" | "all") => void;
  onOpenDeck: () => void;
}) => (
  <>
    <div className="app-no-drag absolute top-3 left-4 z-20 flex items-center gap-3 text-small text-muted-foreground select-none">
      {itemId ? (
        <>
          <Select
            value={scopedMode ?? "due"}
            onValueChange={onScopedModeChange}
            aria-label="Item review queue"
            className="w-20"
            items={[
              {
                value: "due",
                label: "Due",
                description: "This item's cards scheduled for now",
              },
              {
                value: "all",
                label: "All",
                description: "Every card, scheduling untouched",
              },
            ]}
          />
          {showCount && <span className="tabular-nums">{remaining} left</span>}
          {/* The item wears the same inline favicon + title as the card's
              context line below. */}
          <span className="flex min-w-0 items-center gap-1">
            {scopedMode === "all" ? "Cramming" : "Due in"}
            {scopeItem && (
              <>
                <Favicon item={scopeItem} size={12} />
                <span className="max-w-56 truncate">
                  {scopeItem.title || "Untitled"}
                </span>
              </>
            )}
            {scopedMode === "all" && ", scheduling untouched"}
          </span>
        </>
      ) : (
        <>
          <Select
            value={mode}
            onValueChange={onModeChange}
            aria-label="Review queue"
            className="w-20"
            items={[
              {
                value: "due",
                label: "Due",
                description: "Cards scheduled for now",
              },
              {
                value: "new",
                label: "New",
                description: "Cards you haven't learned yet",
              },
            ]}
          />
          {showCount && <span className="tabular-nums">{remaining} left</span>}
        </>
      )}
    </div>
    <TextLink
      variant="quiet"
      href="#"
      className="app-no-drag absolute top-4 right-4 z-20 text-micro font-medium select-none"
      onClick={(event) => {
        event.preventDefault();
        onOpenDeck();
      }}
    >
      All cards
    </TextLink>
  </>
);

// The always-on review, local-first: the due queue is derived from the
// ["all-flashcards"] cache the moment the tab opens — no server round trip in
// the way of the first card (the shell keeps the cache warm). Rating a card
// is a single fire-and-forget scheduling update; there is no session. Review
// one card or all of them, then just leave. "All cards" is the quiet corner
// into the deck.
export const ReviewPane = ({
  itemId,
  onOpenCardInNotes,
}: {
  itemId?: string;
  // Jump to this card inside its item's notes.
  onOpenCardInNotes?: (itemId: string, cardId: string) => void;
}) => {
  const queryClient = useQueryClient();
  const [deckOpen, setDeckOpen] = React.useState(false);
  // The two standing queues; an itemId scopes the pane to that item, with
  // its own choice of just-the-due (scheduled) or everything (cram).
  const [mode, setMode] = React.useState<"due" | "new">("due");
  // null until the cards arrive: the default is Due when the item has due
  // cards, All (cram) otherwise.
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

  // The queue freezes on entry (per mode) from the first data that arrives
  // (usually the cache, instantly); background refetches don't reshuffle a
  // session in progress. Hidden-from-review items are excluded from the
  // standing queues, mirroring the server's rules; orphan cards are always
  // kept, and an explicit cram surfaces the item's cards regardless.
  const [queue, setQueue] = React.useState<QueueCard[] | null>(null);
  const [index, setIndex] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  React.useEffect(() => {
    setQueue(null);
    setIndex(0);
    setRevealed(false);
  }, [mode, scopedMode]);
  React.useEffect(() => {
    if (queue !== null || !allCards) return;
    if (itemId) {
      const { itemCards, dueCards } = itemQueues(allCards, itemId);
      if (scopedMode === null) {
        setScopedMode(dueCards.length > 0 ? "due" : "all");
        return; // re-derive with the resolved mode
      }
      setQueue(scopedMode === "due" ? dueCards : itemCards);
      return;
    }
    // Standing queues need the items list too (hidden-from-review lives on
    // the item); freezing before it arrives would skip that exclusion.
    if (!items) return;
    setQueue(standingQueue(allCards, items, mode));
  }, [allCards, items, queue, itemId, mode, scopedMode]);

  // Reconcile locally-advanced due dates with the server's scheduling on the
  // way out of a run.
  React.useEffect(() => {
    return () => {
      void queryClient.invalidateQueries({ queryKey: ["all-flashcards"] });
    };
  }, [queryClient, itemId, mode, scopedMode]);

  const card = queue?.[index] ?? null;
  const remaining = queue ? queue.length - index : 0;
  const loaded = queue !== null;
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
    [index],
  );
  const commitCard = React.useCallback(() => {
    if (!cardDirtyRef.current) return;
    cardDirtyRef.current = false;
    const current = queue?.[index];
    if (current) saveFlashcard(current);
  }, [queue, index, saveFlashcard]);

  const reveal = React.useCallback(() => {
    setRevealed(true);
  }, []);

  // A scoped All-cards run is a cram: it never touches the schedule.
  const affectsSchedule = !(itemId && scopedMode === "all");
  const rate = React.useCallback(
    (rating: Rating) => {
      if (!card) return;
      const nowIso = new Date().toISOString();
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
      setIndex((current) => current + 1);
      setRevealed(false);
    },
    [card, affectsSchedule, queryClient],
  );

  // Space reveals, 1-4 rate once revealed. Typing contexts are left alone.
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
  }, [deckOpen, card, revealed, reveal, rate]);

  if (deckOpen) return <Deck onBack={() => setDeckOpen(false)} />;

  return (
    <div className="relative flex h-full w-full flex-col px-12 pt-12 pb-6">
      <ReviewHeader
        itemId={itemId}
        scopeItem={scopeItem}
        showCount={loaded && (itemId ? true : !!card)}
        remaining={remaining}
        mode={mode}
        onModeChange={setMode}
        scopedMode={scopedMode}
        onScopedModeChange={setScopedMode}
        onOpenDeck={() => setDeckOpen(true)}
      />

      {!loaded ? (
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center">
          <Skeleton className="h-48 w-full rounded-surface" />
        </div>
      ) : card ? (
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-3">
          {card.itemTitle && (
            // Clicking the source line jumps to this card in the item's notes.
            <Tooltip content="Open in notes">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-1 w-fit max-w-full gap-1.5 px-1 font-normal text-muted-foreground"
                disabled={!card.itemId || !onOpenCardInNotes}
                onClick={() =>
                  card.itemId && onOpenCardInNotes?.(card.itemId, card.id)
                }
              >
                <Favicon
                  item={{
                    url: card.itemUrl ?? "",
                    faviconUrl: card.itemFaviconUrl,
                  }}
                  size={12}
                />
                <span className="min-w-0 truncate">{card.itemTitle}</span>
              </Button>
            </Tooltip>
          )}
          <Flashcard
            key={card.id}
            scale="review"
            front={card.front}
            back={card.back}
            revealed={revealed}
            onRevealedChange={(next) => {
              if (next) reveal();
            }}
            onFrontChange={(front) => patchCard({ front })}
            onBackChange={(back) => patchCard({ back })}
            onCommit={commitCard}
          />
        </div>
      ) : (
        <EmptyState
          className="flex-1 justify-center"
          title="All done"
          description={
            itemId
              ? "This item has no cards."
              : mode === "new"
                ? "No new cards right now."
                : "No cards are due right now."
          }
        />
      )}

      {/* Grades anchor to the bottom centre of the page. */}
      <div className="flex min-h-9 justify-center">
        {loaded && card && revealed && (
          <ButtonGroup>
            {RATINGS.map((rating) => (
              <Button
                key={rating.value}
                variant="secondary"
                onClick={() => rate(rating.value)}
              >
                {rating.label}
                <Kbd className="ml-0.5">{rating.key}</Kbd>
              </Button>
            ))}
          </ButtonGroup>
        )}
      </div>
    </div>
  );
};
