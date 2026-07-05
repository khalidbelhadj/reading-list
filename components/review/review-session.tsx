"use client";

import React from "react";
import { Link } from "@tanstack/react-router";
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
  type ReviewMode,
  type ReviewSessionCard,
  type ReviewSessionData,
  type SessionSummary,
} from "@/app/actions";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverFooter,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { NonIdealState } from "@/components/ui/non-ideal-state";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getFaviconSrc } from "@/components/items-list/utils";
import { schedule, parseCardState, type Rating } from "@/lib/srs";
import { intervalShort, duration } from "@/lib/format-time";
import { cn } from "@/lib/utils";

import { useEventLogger } from "./use-event-logger";

const RATINGS: Array<{ value: Rating; label: string; key: string }> = [
  { value: "again", label: "Again", key: "1" },
  { value: "hard", label: "Hard", key: "2" },
  { value: "good", label: "Good", key: "3" },
  { value: "easy", label: "Easy", key: "4" },
];

const useCompletionConfetti = () => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const instanceRef = React.useRef<confetti.CreateTypes | null>(null);

  React.useEffect(() => {
    return () => {
      if (instanceRef.current) {
        instanceRef.current.reset();
        instanceRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current.remove();
        canvasRef.current = null;
      }
    };
  }, []);

  return React.useCallback(() => {
    if (!instanceRef.current) {
      const canvas = document.createElement("canvas");
      canvas.style.cssText =
        "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100;";
      document.body.appendChild(canvas);
      canvasRef.current = canvas;
      instanceRef.current = confetti.create(canvas, {
        resize: true,
        useWorker: false,
      });
    }
    instanceRef.current({
      particleCount: 60,
      spread: 80,
      ticks: 120,
      gravity: 0.9,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.7 },
    });
  }, []);
};

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
        actions={
          <Button
            variant="ghost"
            size="lg"
            className="w-fit"
            nativeButton={false}
            render={<Link to="/" />}
          >
            Back to list
          </Button>
        }
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
  // Preview mode: rate/skip/end/log all become no-ops and the summary is
  // computed from the in-memory ratings rather than fetched from the server.
  preview?: boolean;
}) => {
  const queryClient = useQueryClient();
  const { log: logEvent, drain: drainEvents } = useEventLogger(
    preview ? null : sessionId,
  );

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
  const completedOnMount = React.useMemo(
    () => new Set(initialData.completedCardIds),
    [initialData.completedCardIds],
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
  // `copiedItemId` drives the tooltip label; `itemIdCopyOpen` force-opens the
  // tooltip after a copy. They reset on a stagger so the label stays "Copied
  // ID" through the close animation instead of flashing back to "Copy item ID".
  const [copiedItemId, setCopiedItemId] = React.useState(false);
  const [itemIdCopyOpen, setItemIdCopyOpen] = React.useState(false);
  const [itemIdTooltipOpen, setItemIdTooltipOpen] = React.useState(false);
  const copyTimersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  // Preview-only: ending early has no server `endedAt` to read back, so we
  // track it locally; ratings accumulate here to build the summary.
  const [previewEnded, setPreviewEnded] = React.useState(false);
  const previewStartRef = React.useRef(performance.now());
  const previewStatsRef = React.useRef({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
    totalActiveMs: 0,
    revealSum: 0,
    revealCount: 0,
  });

  const cardShownAtRef = React.useRef<number | null>(null);
  const revealedAtRef = React.useRef<number | null>(null);
  const lastLoggedShownRef = React.useRef<string | null>(null);

  const sessionEnded = Boolean(session.endedAt);
  const currentCard: ReviewSessionCard | undefined = cards[currentIndex];

  const handleCopyItemId = React.useCallback((itemId: string) => {
    navigator.clipboard.writeText(itemId).then(
      () => {
        copyTimersRef.current.forEach(clearTimeout);
        setCopiedItemId(true);
        setItemIdCopyOpen(true);
        copyTimersRef.current = [
          // Start closing the tooltip...
          setTimeout(() => setItemIdCopyOpen(false), 1300),
          // ...then clear the label once the close animation has finished, so
          // it never flashes back to "Copy item ID" mid-fade.
          setTimeout(() => setCopiedItemId(false), 1500),
        ];
      },
      () => {},
    );
  }, []);

  React.useEffect(() => () => copyTimersRef.current.forEach(clearTimeout), []);

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
      preview
        ? Promise.resolve()
        : endReviewSession({ sessionId, reason, events: drainEvents() }),
    onSuccess: () => {
      if (preview) return;
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
  });

  const rateMutation = useMutation({
    mutationFn: (args: {
      flashcardId: string;
      rating: Rating;
      durationMs: number;
      timeToRevealMs: number | null;
    }) =>
      preview
        ? Promise.resolve()
        : rateCard({ sessionId, ...args, events: drainEvents() }),
    onSuccess: () => {
      if (preview) return;
      queryClient.invalidateQueries({
        queryKey: ["review-summary", sessionId],
      });
    },
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

      if (preview) {
        const stats = previewStatsRef.current;
        stats[rating] += 1;
        stats.totalActiveMs += durationMs;
        if (timeToRevealMs != null) {
          stats.revealSum += timeToRevealMs;
          stats.revealCount += 1;
        }
      }

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
    [
      currentCard,
      currentIndex,
      cards.length,
      rateMutation,
      endMutation,
      preview,
    ],
  );

  const createRateHandler = (rating: Rating) => () => {
    handleRate(rating);
  };

  const handleSkip = React.useCallback(() => {
    if (!currentCard) return;
    const now = performance.now();
    const shownAt = cardShownAtRef.current ?? now;
    const durationMs = Math.round(now - shownAt);
    if (!preview) {
      skipCard({
        sessionId,
        flashcardId: currentCard.id,
        afterReveal: revealed,
        durationMs,
      });
    }

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
    preview,
  ]);

  const handleRequestEnd = React.useCallback(() => {
    if (endMutation.isPending || sessionEnded) return;
    setEndConfirmOpen(true);
  }, [endMutation.isPending, sessionEnded]);
  const handleConfirmEnd = React.useCallback(() => {
    if (endMutation.isPending || sessionEnded) return;
    if (preview) {
      setEndConfirmOpen(false);
      setPreviewEnded(true);
      return;
    }
    endMutation.mutate("user_ended");
  }, [endMutation, sessionEnded, preview]);
  const handleRequestEndOpenChange = React.useCallback(
    // The trigger toggles via onOpenChange, so handle both directions; the
    // pending guard keeps it pinned open while the end request is in flight.
    (open: boolean) => {
      if (endMutation.isPending) return;
      setEndConfirmOpen(open);
    },
    [endMutation.isPending],
  );

  // Mirror open state into a ref so the keyboard handler can read it without
  // re-subscribing on every toggle.
  const endConfirmOpenRef = React.useRef(endConfirmOpen);
  React.useEffect(() => {
    endConfirmOpenRef.current = endConfirmOpen;
  }, [endConfirmOpen]);

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
      // While the end-session popover is open it owns the keyboard — let it
      // handle Escape/outside-click to close; don't rate or skip behind it.
      if (endConfirmOpenRef.current) return;
      if (e.key === " ") {
        e.preventDefault();
        if (!revealed) handleReveal();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleRequestEnd();
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
  }, [
    sessionEnded,
    revealed,
    handleReveal,
    handleRate,
    handleSkip,
    handleRequestEnd,
  ]);

  if (sessionEnded || previewEnded || currentIndex >= cards.length) {
    const previewSummary: SessionSummary | undefined = preview
      ? {
          mode: session.mode as ReviewMode,
          scope: null,
          totalCards: cards.length,
          ratedCards:
            previewStatsRef.current.again +
            previewStatsRef.current.hard +
            previewStatsRef.current.good +
            previewStatsRef.current.easy,
          ratings: {
            again: previewStatsRef.current.again,
            hard: previewStatsRef.current.hard,
            good: previewStatsRef.current.good,
            easy: previewStatsRef.current.easy,
          },
          totalActiveMs: previewStatsRef.current.totalActiveMs,
          wallClockMs: Math.round(performance.now() - previewStartRef.current),
          avgTimeToRevealMs: previewStatsRef.current.revealCount
            ? Math.round(
                previewStatsRef.current.revealSum /
                  previewStatsRef.current.revealCount,
              )
            : null,
        }
      : undefined;
    return (
      <SessionSummaryView
        sessionId={sessionId}
        cardCount={cards.length}
        mockSummary={previewSummary}
      />
    );
  }

  if (!currentCard) {
    return (
      <NonIdealState
        fullPage
        align="center"
        size="sm"
        title="No cards available"
        description="This review session doesn't have any cards to show."
        actions={
          <Button
            variant="ghost"
            size="lg"
            className="w-fit"
            nativeButton={false}
            render={<Link to="/" />}
          >
            Back to list
          </Button>
        }
      />
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

  const itemId = currentCard.itemId;

  const metaContent = (
    <>
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
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="electron-top-bar-inset sticky top-0 z-10 bg-background pt-3 pb-2">
        <div className="mx-auto flex h-7 w-full max-w-3xl items-center gap-4 px-6 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {currentIndex + 1} of {cards.length}
          </span>
          <div className="flex flex-1 items-center gap-1">
            {cards.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  i < currentIndex
                    ? "bg-primary"
                    : i === currentIndex
                      ? "animate-pulse bg-primary/60"
                      : "bg-border",
                )}
              />
            ))}
          </div>
          <Popover
            open={endConfirmOpen}
            onOpenChange={handleRequestEndOpenChange}
          >
            <PopoverTrigger
              disabled={endMutation.isPending}
              render={
                <button
                  type="button"
                  className="flex items-center gap-1.5 transition-colors hover:text-foreground disabled:opacity-60"
                />
              }
            >
              End session
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" sideOffset={8}>
              <PopoverHeader>
                <PopoverTitle>End this session?</PopoverTitle>
                <PopoverDescription>
                  You&rsquo;ve reviewed {currentIndex} of {cards.length} cards.
                  You can&rsquo;t resume this session, so ending it now will
                  finish it for good.
                </PopoverDescription>
              </PopoverHeader>
              <PopoverFooter>
                <PopoverClose disabled={endMutation.isPending}>
                  Keep going
                </PopoverClose>
                <Button
                  variant="destructive"
                  onClick={handleConfirmEnd}
                  disabled={endMutation.isPending}
                >
                  {endMutation.isPending && <Spinner className="size-3" />}
                  End session
                </Button>
              </PopoverFooter>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-6">
        <main className="flex flex-1 flex-col justify-center py-12">
          <div className="flex flex-col gap-6">
            {(currentCard.itemTitle || itemDomain) &&
              (itemId ? (
                <Tooltip
                  open={itemIdTooltipOpen || itemIdCopyOpen}
                  onOpenChange={setItemIdTooltipOpen}
                >
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="xs"
                        className="-mx-1.5 h-auto w-fit gap-2 px-1.5 py-1 text-xs font-normal text-muted-foreground"
                        onClick={() => handleCopyItemId(itemId)}
                      >
                        {metaContent}
                      </Button>
                    }
                  />
                  <TooltipContent>
                    {copiedItemId ? "Copied ID" : "Copy item ID"}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {metaContent}
                </div>
              ))}

            <div className="font-content">
              <MarkdownEditor
                value={currentCard.front}
                editable={false}
                className="[&_.ProseMirror]:text-2xl! [&_.ProseMirror]:leading-snug"
              />
            </div>

            {revealed && (
              <>
                <div className="border-t border-border" />
                <div className="font-content">
                  <MarkdownEditor
                    value={currentCard.back}
                    editable={false}
                    className="text-foreground [&_.ProseMirror]:text-xl! [&_.ProseMirror]:leading-relaxed"
                  />
                </div>
              </>
            )}
          </div>
        </main>

        <footer className="flex items-center justify-end gap-3">
          {revealed ? (
            <div className="flex items-center gap-2">
              {RATINGS.map((r) => {
                const next = schedule(
                  {
                    state: parseCardState(currentCard.state),
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
                const interval = intervalShort(next.due, nowIso);
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
                    <span
                      className={cn(
                        "text-[0.6875rem]",
                        r.value === "again"
                          ? "text-destructive/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {interval}
                    </span>
                    <Kbd
                      variant={r.value === "again" ? "destructive" : "default"}
                      size="xs"
                    >
                      {r.key}
                    </Kbd>
                  </Button>
                );
              })}
            </div>
          ) : (
            <Button size="lg" onClick={handleReveal} className="gap-2">
              Reveal answer
              <Kbd variant="primary" size="xs">
                Space
              </Kbd>
            </Button>
          )}
        </footer>
      </div>
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

export const SessionSummaryView = ({
  sessionId,
  cardCount,
  mockSummary,
}: {
  sessionId: string;
  cardCount: number;
  mockSummary?: SessionSummary;
}) => {
  const query = useQuery({
    queryKey: ["review-summary", sessionId],
    queryFn: () => getSessionSummary(sessionId),
    enabled: !mockSummary,
  });
  const summary = mockSummary ?? query.data;
  const isSummaryLoading = mockSummary ? false : query.isLoading;

  const fireCompletionConfetti = useCompletionConfetti();
  const firedRef = React.useRef(false);
  React.useEffect(() => {
    if (firedRef.current || !summary) return;
    if (summary.ratedCards === cardCount && cardCount > 0) {
      firedRef.current = true;
      fireCompletionConfetti();
    }
  }, [summary, cardCount, fireCompletionConfetti]);

  if (isSummaryLoading || !summary) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <div className="flex items-center justify-center gap-2 font-content text-2xl font-medium">
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
            value={duration(summary.totalActiveMs)}
            description="Time actually spent on cards, summed across each card's show-to-rate duration."
          />
          <SummaryStat
            label="Wall time"
            value={duration(summary.wallClockMs)}
            description="Total elapsed time from session start to end, including any pauses."
          />
          <SummaryStat
            label="Avg. think"
            value={
              summary.avgTimeToRevealMs != null
                ? duration(summary.avgTimeToRevealMs)
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
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full",
                        r.value === "again"
                          ? "bg-destructive"
                          : r.value === "hard"
                            ? "bg-primary/40"
                            : "bg-primary",
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

        <div className="mx-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="lg"
            nativeButton={false}
            render={<Link to="/" />}
          >
            Back to list
          </Button>
        </div>
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
  <div className="flex flex-col gap-0.5 rounded-lg bg-card px-3 py-2">
    <div className="flex items-center justify-between gap-2">
      <div className="text-[0.6875rem] text-muted-foreground">{label}</div>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={`About ${label}`}
              className="-mr-0.5 cursor-help text-muted-foreground/60 transition-colors hover:text-muted-foreground"
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
