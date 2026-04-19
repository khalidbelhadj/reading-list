"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconFileFilled, IconInfoCircle } from "@tabler/icons-react";
import confetti from "canvas-confetti";

import {
  endReviewSession,
  getReviewSession,
  getSessionSummary,
  rateCard,
  skipCard,
  type ReviewSessionCard,
  type ReviewSessionData,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getFaviconSrc } from "@/components/items-list/utils";
import { schedule, type Rating } from "@/lib/srs";
import { cn } from "@/lib/utils";

import { useEventLogger } from "./use-event-logger";

const RATINGS: Array<{ value: Rating; label: string; key: string }> = [
  { value: "again", label: "Again", key: "1" },
  { value: "hard", label: "Hard", key: "2" },
  { value: "good", label: "Good", key: "3" },
  { value: "easy", label: "Easy", key: "4" },
];

const formatInterval = (dueIso: string, nowIso: string) => {
  const ms = new Date(dueIso).getTime() - new Date(nowIso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
};

const fireCompletionConfetti = () => {
  confetti({
    particleCount: 60,
    spread: 80,
    ticks: 120,
    gravity: 0.9,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.7 },
  });
};

const formatDuration = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
};

export const ReviewSession = ({
  initialData,
  sessionId,
}: {
  initialData: ReviewSessionData;
  sessionId: string;
}) => {
  const queryClient = useQueryClient();
  const logEvent = useEventLogger(sessionId);

  const { data } = useQuery({
    queryKey: ["review-session", sessionId],
    queryFn: () => getReviewSession(sessionId),
    initialData,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const session = data?.session ?? initialData.session;
  const cards = data?.cards ?? initialData.cards;
  const completedOnMount = React.useMemo(
    () => new Set(initialData.completedCardIds),
    [initialData.completedCardIds],
  );

  const initialIndex = React.useMemo(() => {
    for (let i = 0; i < cards.length; i++) {
      if (!completedOnMount.has(cards[i].id)) return i;
    }
    return cards.length;
  }, [cards, completedOnMount]);

  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [revealed, setRevealed] = React.useState(false);

  const cardShownAtRef = React.useRef<number | null>(null);
  const revealedAtRef = React.useRef<number | null>(null);
  const lastLoggedShownRef = React.useRef<string | null>(null);

  const sessionEnded = Boolean(session.endedAt);
  const currentCard: ReviewSessionCard | undefined = cards[currentIndex];

  React.useEffect(() => {
    if (sessionEnded || !currentCard) return;
    if (lastLoggedShownRef.current === currentCard.id) return;
    cardShownAtRef.current = performance.now();
    revealedAtRef.current = null;
    lastLoggedShownRef.current = currentCard.id;
    logEvent({
      type: "card_shown",
      flashcardId: currentCard.id,
      data: null,
    });
  }, [currentCard, sessionEnded, logEvent]);

  const handleReveal = React.useCallback(() => {
    if (!currentCard || revealed) return;
    revealedAtRef.current = performance.now();
    setRevealed(true);
    const shownAt = cardShownAtRef.current;
    const timeToRevealMs =
      shownAt != null ? Math.round(performance.now() - shownAt) : 0;
    logEvent({
      type: "answer_revealed",
      flashcardId: currentCard.id,
      data: { timeToRevealMs },
    });
  }, [currentCard, revealed, logEvent]);

  const endMutation = useMutation({
    mutationFn: (reason: "completed" | "user_ended") =>
      endReviewSession({ sessionId, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["review-session", sessionId],
      });
      queryClient.invalidateQueries({ queryKey: ["all-flashcards"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const rateMutation = useMutation({
    mutationFn: (args: {
      flashcardId: string;
      rating: Rating;
      durationMs: number;
      timeToRevealMs: number | null;
    }) => rateCard({ sessionId, ...args }),
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

  const createRateHandler = (rating: Rating) => () => {
    handleRate(rating);
  };

  const handleSkip = React.useCallback(() => {
    if (!currentCard) return;
    const now = performance.now();
    const shownAt = cardShownAtRef.current ?? now;
    const durationMs = Math.round(now - shownAt);
    skipCard({
      sessionId,
      flashcardId: currentCard.id,
      afterReveal: revealed,
      durationMs,
      // TODO: What is this catch doing??
    }).catch(() => {});

    const isLast = currentIndex >= cards.length - 1;
    setRevealed(false);
    setCurrentIndex((i) => i + 1);
    if (isLast) endMutation.mutate("completed");
  }, [
    currentCard,
    revealed,
    sessionId,
    currentIndex,
    cards.length,
    endMutation,
  ]);

  const handleEnd = React.useCallback(() => {
    if (endMutation.isPending || sessionEnded) return;
    endMutation.mutate("user_ended");
  }, [endMutation, sessionEnded]);

  React.useEffect(() => {
    if (sessionEnded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          e.target.isContentEditable
        ) {
          return;
        }
      }
      if (e.key === " ") {
        e.preventDefault();
        if (!revealed) handleReveal();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleEnd();
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleSkip();
        return;
      }
      if (!revealed) return;
      const rating = RATINGS.find((r) => r.key === e.key);
      if (rating) {
        e.preventDefault();
        handleRate(rating.value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sessionEnded, revealed, handleReveal, handleRate, handleSkip, handleEnd]);

  if (sessionEnded || currentIndex >= cards.length) {
    return (
      <SessionSummaryView sessionId={sessionId} cardCount={cards.length} />
    );
  }

  if (!currentCard) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-muted-foreground text-sm">
            No cards available for this session.
          </div>
          <Button
            variant="ghost"
            size="lg"
            className="w-fit"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Back to list
          </Button>
        </div>
      </div>
    );
  }

  const favicon = currentCard.itemUrl
    ? getFaviconSrc({
        url: currentCard.itemUrl,
        faviconUrl: currentCard.itemFaviconUrl ?? null,
      })
    : null;

  const itemDomain = currentCard.itemUrl
    ? safeHostname(currentCard.itemUrl)
    : null;

  return (
    <div className="min-h-screen flex flex-col px-6 py-6 max-w-3xl mx-auto w-full">
      <header className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            {currentIndex + 1} of {cards.length}
          </span>
        </div>
        <div className="flex-1 flex items-center gap-1">
          {cards.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-0.5 flex-1 rounded-full",
                i < currentIndex
                  ? "bg-foreground"
                  : i === currentIndex
                    ? "bg-foreground/60 animate-pulse"
                    : "bg-border",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleEnd}
          disabled={endMutation.isPending}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors disabled:opacity-60"
        >
          {endMutation.isPending && <Spinner className="size-3" />}
          End session
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center py-12">
        <div className="flex flex-col gap-6">
          {(currentCard.itemTitle || itemDomain) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {favicon ? (
                <Image
                  src={favicon}
                  alt=""
                  width={14}
                  height={14}
                  className="size-3.5 rounded-[3px]"
                  unoptimized
                />
              ) : (
                <IconFileFilled className="size-3.5" />
              )}
              {currentCard.itemTitle && (
                <span className="italic">{currentCard.itemTitle}</span>
              )}
              {itemDomain && <span>· {itemDomain}</span>}
            </div>
          )}

          <div className="font-content">
            <MarkdownEditor
              value={currentCard.front}
              editable={false}
              className="text-2xl leading-snug"
            />
          </div>

          {revealed && (
            <>
              <div className="border-t border-border" />
              <div className="font-content">
                <MarkdownEditor
                  value={currentCard.back}
                  editable={false}
                  className="text-xl leading-relaxed text-foreground"
                />
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {revealed ? (
            <span>Rate 1–4</span>
          ) : (
            <span>
              Press <kbd className="font-mono">Space</kbd> to reveal
            </span>
          )}
        </div>
        {revealed ? (
          <div className="flex items-center gap-2">
            {RATINGS.map((r) => {
              const next = schedule(
                {
                  state: currentCard.state as
                    | "new"
                    | "learning"
                    | "review"
                    | "relearning",
                  interval: currentCard.interval,
                  easeFactor: currentCard.easeFactor,
                  reps: currentCard.reps,
                  lapses: currentCard.lapses,
                  due: currentCard.due,
                },
                r.value,
                new Date().toISOString(),
              );
              const nowIso = new Date().toISOString();
              const interval = formatInterval(next.due, nowIso);
              return (
                <Button
                  key={r.value}
                  size="lg"
                  variant={r.value === "again" ? "destructive" : "outline"}
                  onClick={createRateHandler(r.value)}
                  disabled={rateMutation.isPending}
                  className="gap-2"
                >
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground text-[0.6875rem]">
                    {interval}
                  </span>
                  <kbd className="text-[0.625rem] text-muted-foreground font-mono">
                    {r.key}
                  </kbd>
                </Button>
              );
            })}
          </div>
        ) : (
          <Button size="lg" onClick={handleReveal}>
            Reveal answer
          </Button>
        )}
      </footer>
    </div>
  );
};

const safeHostname = (url: string): string | null => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

const SessionSummaryView = ({
  sessionId,
  cardCount,
}: {
  sessionId: string;
  cardCount: number;
}) => {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["review-summary", sessionId],
    queryFn: () => getSessionSummary(sessionId),
  });

  const firedRef = React.useRef(false);
  React.useEffect(() => {
    if (firedRef.current || !summary) return;
    if (summary.ratedCards === cardCount && cardCount > 0) {
      firedRef.current = true;
      fireCompletionConfetti();
    }
  }, [summary, cardCount]);

  if (isLoading || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <div className="font-content text-2xl font-medium flex items-center justify-center gap-2">
            <span>
              {summary.ratedCards === cardCount && cardCount > 0
                ? "Session complete"
                : "Session ended"}
            </span>
            {summary.mode === "cram" && <Badge variant="secondary">Cram</Badge>}
          </div>
          <div className="text-sm text-muted-foreground">
            {summary.ratedCards} of {cardCount} cards reviewed
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SummaryStat
            label="Active time"
            value={formatDuration(summary.totalActiveMs)}
            description="Time actually spent on cards, summed across each card's show-to-rate duration."
          />
          <SummaryStat
            label="Wall time"
            value={formatDuration(summary.wallClockMs)}
            description="Total elapsed time from session start to end, including any pauses."
          />
          <SummaryStat
            label="Avg. think"
            value={
              summary.avgTimeToRevealMs != null
                ? formatDuration(summary.avgTimeToRevealMs)
                : "-"
            }
            description="Average time from seeing a card to revealing the answer."
          />
          <SummaryStat
            label="Accuracy"
            value={
              summary.ratedCards > 0
                ? `${Math.round(
                    ((summary.ratings.good + summary.ratings.easy) /
                      summary.ratedCards) *
                      100,
                  )}%`
                : "-"
            }
            description="Percentage of cards rated Good or Easy (i.e. not Again or Hard)."
          />
        </div>

        {summary.ratedCards > 0 && (
          <div className="flex flex-col gap-2">
            {RATINGS.map((r) => {
              const count = summary.ratings[r.value];
              const pct = (count / summary.ratedCards) * 100;
              return (
                <div key={r.value} className="flex items-center gap-2 text-xs">
                  <span className="w-12 text-muted-foreground">{r.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full",
                        r.value === "again"
                          ? "bg-destructive"
                          : r.value === "hard"
                            ? "bg-foreground/40"
                            : "bg-foreground",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        )}

        <Button
          variant="ghost"
          size="lg"
          className="w-fit mx-auto"
          nativeButton={false}
          render={<Link href="/" />}
        >
          Back to list
        </Button>
      </div>
    </div>
  );
};

const SummaryStat = ({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) => (
  <div className="rounded-lg bg-card px-3 py-2 flex flex-col gap-0.5">
    <div className="flex items-center justify-between gap-2">
      <div className="text-[0.6875rem] text-muted-foreground">{label}</div>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={`About ${label}`}
              className="text-muted-foreground/60 hover:text-muted-foreground transition-colors -mr-0.5 cursor-help"
            >
              <IconInfoCircle className="size-3" />
            </button>
          }
        />
        <TooltipContent>{description}</TooltipContent>
      </Tooltip>
    </div>
    <div className="font-content text-base">{value}</div>
  </div>
);
