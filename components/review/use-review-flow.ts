// The review session's engine: index/reveal state, rate/skip/end mutations,
// and telemetry timers — behind the ReviewBackend interface so the preview
// mode swaps in an in-memory backend instead of branching inline.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";

import {
  endReviewSession,
  rateCard,
  type ReviewSessionCard,
  type SessionSummary,
  skipCard,
} from "@/app/actions";
import type { ReviewEvent } from "@/lib/review-events.server";
import type { Rating } from "@/lib/srs";

import { useEventLogger } from "./use-event-logger";

// The operations a review session runs against. Production talks to the real
// server actions (useProductionBackend below); the dev-only debug preview
// substitutes an in-memory backend (see preview-backend.ts) so the flow code
// itself carries zero preview conditionals.
export type ReviewBackend = {
  // Log/queue a telemetry event for the current card.
  logEvent: (event: ReviewEvent) => void;
  // Persist a rating. The flow advances optimistically; onRateSuccess fires
  // after the backend confirms (cache invalidation in production).
  rateCard: (args: {
    flashcardId: string;
    rating: Rating;
    durationMs: number;
    timeToRevealMs: number | null;
  }) => Promise<void>;
  onRateSuccess: () => void;
  // Fire-and-forget skip.
  skipCard: (args: {
    flashcardId: string;
    afterReveal: boolean;
    durationMs: number;
  }) => void;
  endSession: (reason: "completed" | "user_ended") => Promise<void>;
  onEndSuccess: () => void;
  // The backend's own "session over" flag, for backends with no server
  // `endedAt` to read back (preview's user-ended state). Always false in
  // production — there the session row is the source of truth.
  ended: boolean;
  // When this returns a summary, the summary screen renders it instead of
  // fetching by session id. Production returns undefined.
  getSummary: () => SessionSummary | undefined;
};

// The real backend: server actions + React Query cache invalidation.
// card_shown / answer_revealed events queue locally and flush with the next
// rate/end call (see use-event-logger.ts).
export const useProductionBackend = (sessionId: string): ReviewBackend => {
  const queryClient = useQueryClient();
  const { log: logEvent, drain: drainEvents } = useEventLogger(sessionId);

  return React.useMemo(
    () => ({
      logEvent,
      rateCard: async (args) => {
        await rateCard({ sessionId, ...args, events: drainEvents() });
      },
      onRateSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["review-summary", sessionId],
        });
      },
      skipCard: (args) => {
        skipCard({ sessionId, ...args });
      },
      endSession: async (reason) => {
        await endReviewSession({ sessionId, reason, events: drainEvents() });
      },
      onEndSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["review-session", sessionId],
        });
        queryClient.invalidateQueries({
          queryKey: ["review-summary", sessionId],
        });
        queryClient.invalidateQueries({ queryKey: ["all-flashcards"] });
        queryClient.invalidateQueries({ queryKey: ["items"] });
        queryClient.invalidateQueries({ queryKey: ["review-status"] });
        queryClient.invalidateQueries({ queryKey: ["item-review-status"] });
      },
      ended: false,
      getSummary: () => undefined,
    }),
    [sessionId, queryClient, logEvent, drainEvents],
  );
};

// Card progression state (current index, reveal), the rate/skip/end
// operations, and the show/reveal telemetry timers — everything about a
// running session except its rendering and its backend.
export const useReviewFlow = ({
  cards,
  completedCardIds,
  sessionEnded,
  backend,
}: {
  cards: ReviewSessionCard[];
  completedCardIds: string[];
  sessionEnded: boolean;
  backend: ReviewBackend;
}) => {
  const completedOnMount = React.useMemo(
    () => new Set(completedCardIds),
    [completedCardIds],
  );

  const initialIndex = React.useMemo(() => {
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (card !== undefined && !completedOnMount.has(card.id)) return i;
    }
    return cards.length;
  }, [cards, completedOnMount]);

  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [revealed, setRevealed] = React.useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = React.useState(false);

  const cardShownAtRef = React.useRef<number | null>(null);
  const revealedAtRef = React.useRef<number | null>(null);
  const lastLoggedShownRef = React.useRef<string | null>(null);

  const currentCard: ReviewSessionCard | undefined = cards[currentIndex];

  React.useEffect(() => {
    if (sessionEnded || !currentCard) return;
    if (lastLoggedShownRef.current === currentCard.id) return;
    cardShownAtRef.current = performance.now();
    revealedAtRef.current = null;
    lastLoggedShownRef.current = currentCard.id;
    backend.logEvent({
      type: "card_shown",
      flashcardId: currentCard.id,
      data: null,
    });
  }, [currentCard, sessionEnded, backend]);

  const handleReveal = React.useCallback(() => {
    if (!currentCard || revealed) return;
    revealedAtRef.current = performance.now();
    setRevealed(true);
    const shownAt = cardShownAtRef.current;
    const timeToRevealMs =
      shownAt != null ? Math.round(performance.now() - shownAt) : 0;
    backend.logEvent({
      type: "answer_revealed",
      flashcardId: currentCard.id,
      data: { timeToRevealMs },
    });
  }, [currentCard, revealed, backend]);

  const endMutation = useMutation({
    mutationFn: (reason: "completed" | "user_ended") =>
      backend.endSession(reason),
    onSuccess: () => backend.onEndSuccess(),
  });

  const rateMutation = useMutation({
    mutationFn: (args: {
      flashcardId: string;
      rating: Rating;
      durationMs: number;
      timeToRevealMs: number | null;
    }) => backend.rateCard(args),
    onSuccess: () => backend.onRateSuccess(),
  });

  const handleRate = React.useCallback(
    (rating: Rating) => {
      if (!currentCard) return;
      const now = performance.now();
      const shownAt = cardShownAtRef.current ?? now;
      const revealedAt = revealedAtRef.current;
      const durationMs = Math.round(now - shownAt);
      const timeToRevealMs =
        revealedAt != null ? Math.round(revealedAt - shownAt) : null;

      const isLast = currentIndex >= cards.length - 1;
      const flashcardId = currentCard.id;

      rateMutation.mutate(
        { flashcardId, rating, durationMs, timeToRevealMs },
        {
          onSuccess: () => {
            if (isLast) {
              endMutation.mutate("completed");
            }
          },
        },
      );

      setRevealed(false);
      setCurrentIndex((i) => i + 1);
    },
    [currentCard, currentIndex, cards.length, rateMutation, endMutation],
  );

  const handleSkip = React.useCallback(() => {
    if (!currentCard) return;
    const now = performance.now();
    const shownAt = cardShownAtRef.current ?? now;
    const durationMs = Math.round(now - shownAt);
    backend.skipCard({
      flashcardId: currentCard.id,
      afterReveal: revealed,
      durationMs,
    });

    const isLast = currentIndex >= cards.length - 1;
    setRevealed(false);
    setCurrentIndex((i) => i + 1);
    if (isLast) endMutation.mutate("completed");
  }, [currentCard, revealed, currentIndex, cards.length, endMutation, backend]);

  const handleRequestEnd = React.useCallback(() => {
    if (endMutation.isPending || sessionEnded) return;
    setEndConfirmOpen(true);
  }, [endMutation.isPending, sessionEnded]);
  const handleConfirmEnd = React.useCallback(() => {
    if (endMutation.isPending || sessionEnded) return;
    endMutation.mutate("user_ended");
  }, [endMutation, sessionEnded]);
  const handleRequestEndOpenChange = React.useCallback(
    // The trigger toggles via onOpenChange, so handle both directions; the
    // pending guard keeps it pinned open while the end request is in flight.
    (open: boolean) => {
      if (endMutation.isPending) return;
      setEndConfirmOpen(open);
    },
    [endMutation.isPending],
  );

  return {
    currentIndex,
    revealed,
    endConfirmOpen,
    currentCard,
    finished: sessionEnded || backend.ended || currentIndex >= cards.length,
    ratePending: rateMutation.isPending,
    endPending: endMutation.isPending,
    handleReveal,
    handleRate,
    handleSkip,
    handleRequestEnd,
    handleConfirmEnd,
    handleRequestEndOpenChange,
  };
};
