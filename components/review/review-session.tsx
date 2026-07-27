import { useQuery } from "@tanstack/react-query";

import { getReviewSession, type ReviewSessionData } from "@/app/actions";
import { NonIdealState } from "@/components/ui/non-ideal-state";
import { Spinner } from "@/components/ui/spinner";

import { BackToListButton } from "./back-to-list-button";
import { usePreviewBackend } from "./preview-backend";
import { ReviewCardScreen } from "./review-card-screen";
import { SessionSummaryView } from "./session-summary";
import { useProductionBackend, useReviewFlow } from "./use-review-flow";
import { useReviewKeyboard } from "./use-review-keyboard";

// Loader / not-found gate plus composition: picks the backend (server actions
// or the in-memory preview one), runs the flow hook, and renders the card
// screen or the summary.

export const ReviewSession = ({
  sessionId,
  previewData,
}: {
  sessionId: string;
  // When provided, the session runs entirely in-memory (no server reads or
  // writes) — used by the dev-only debug preview route. See ReviewSessionInner.
  previewData?: ReviewSessionData;
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ["review-session", sessionId],
    queryFn: () => getReviewSession(sessionId),
    enabled: !previewData,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const resolved = previewData ?? data;

  if (!previewData && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  if (!resolved) {
    return (
      <NonIdealState
        fullPage
        align="center"
        size="sm"
        title="Review session not found"
        description="It may have ended, or the link is no longer valid."
        actions={<BackToListButton />}
      />
    );
  }

  return (
    <ReviewSessionInner
      sessionId={sessionId}
      initialData={resolved}
      preview={Boolean(previewData)}
    />
  );
};

const ReviewSessionInner = ({
  sessionId,
  initialData,
  preview = false,
}: {
  sessionId: string;
  initialData: ReviewSessionData;
  // Preview mode swaps the production backend for the in-memory one (see
  // preview-backend.ts) — the flow itself is identical.
  preview?: boolean;
}) => {
  const { data } = useQuery({
    queryKey: ["review-session", sessionId],
    queryFn: () => getReviewSession(sessionId),
    initialData,
    enabled: !preview,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const session = data?.session ?? initialData.session;
  const cards = data?.cards ?? initialData.cards;
  const sessionEnded = Boolean(session.endedAt);

  // Both backend hooks always run (hooks can't be conditional); only the
  // chosen one is ever invoked.
  const productionBackend = useProductionBackend(sessionId);
  const previewBackend = usePreviewBackend({
    mode: session.mode,
    totalCards: cards.length,
  });
  const backend = preview ? previewBackend : productionBackend;

  const flow = useReviewFlow({
    cards,
    completedCardIds: initialData.completedCardIds,
    sessionEnded,
    backend,
  });

  useReviewKeyboard({
    enabled: !sessionEnded,
    revealed: flow.revealed,
    endConfirmOpen: flow.endConfirmOpen,
    onReveal: flow.handleReveal,
    onRate: flow.handleRate,
    onSkip: flow.handleSkip,
    onRequestEnd: flow.handleRequestEnd,
  });

  if (flow.finished) {
    return (
      <SessionSummaryView
        sessionId={sessionId}
        cardCount={cards.length}
        mockSummary={backend.getSummary()}
      />
    );
  }

  if (!flow.currentCard) {
    return (
      <NonIdealState
        fullPage
        align="center"
        size="sm"
        title="No cards available"
        description="This review session doesn't have any cards to show."
        actions={<BackToListButton />}
      />
    );
  }

  return (
    <ReviewCardScreen
      card={flow.currentCard}
      currentIndex={flow.currentIndex}
      cardCount={cards.length}
      revealed={flow.revealed}
      ratePending={flow.ratePending}
      endPending={flow.endPending}
      endConfirmOpen={flow.endConfirmOpen}
      onEndConfirmOpenChange={flow.handleRequestEndOpenChange}
      onConfirmEnd={flow.handleConfirmEnd}
      onReveal={flow.handleReveal}
      onRate={flow.handleRate}
    />
  );
};
