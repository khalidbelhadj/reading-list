import { IconInfoCircle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import React from "react";

import { getSessionSummary, type SessionSummary } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { duration } from "@/lib/format-time";
import { cn } from "@/lib/utils";

import { BackToListButton } from "./back-to-list-button";
import { RATINGS } from "./ratings";

// The post-session summary screen: headline stats, per-rating bars, and a
// confetti burst when every card was reviewed.

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
          <BackToListButton />
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
        {/* Raw button, not shadcn Button: this is a bare icon-only hint with
            a custom cursor and no fixed box or background — Button's
            icon-size chrome would add padding/hover-bg the tight stat-row
            layout doesn't have room for. */}
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
