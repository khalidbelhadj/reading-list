"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getReviewStatus } from "@/app/actions";
import { relativeTime } from "@/lib/format-time";

import { useStartReview } from "./use-start-review";
import { ReviewConfirmDialog } from "./review-confirm-dialog";

const STALE_DAYS = 4;
const DISMISS_HOURS = 24;
const DISMISS_KEY = "reviewNudgeDismissedAt";
const DAY_MS = 1000 * 60 * 60 * 24;

export const ReviewNudge = () => {
  const { data } = useQuery({
    queryKey: ["review-status"],
    queryFn: getReviewStatus,
  });
  const { startingMode, startReview } = useStartReview();
  const isStarting = startingMode !== null;
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(true);

  React.useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (!stored) {
      setDismissed(false);
      return;
    }
    const elapsedHours = (Date.now() - new Date(stored).getTime()) / (1000 * 60 * 60);
    setDismissed(elapsedHours < DISMISS_HOURS);
  }, []);

  const handleDismiss = React.useCallback(() => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setDismissed(true);
  }, []);

  const handleReview = React.useCallback(() => {
    setConfirmOpen(true);
  }, []);
  const handleConfirm = React.useCallback(
    (limit: number) => {
      startReview("due", limit);
    },
    [startReview],
  );
  const handleConfirmOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && !isStarting) setConfirmOpen(false);
    },
    [isStarting],
  );
  const wasStartingRef = React.useRef(false);
  React.useEffect(() => {
    if (wasStartingRef.current && !isStarting && confirmOpen) {
      setConfirmOpen(false);
    }
    wasStartingRef.current = isStarting;
  }, [isStarting, confirmOpen]);

  if (dismissed || !data) return null;
  const { dueCount, lastReviewedAt } = data;
  if (dueCount === 0 || !lastReviewedAt) return null;
  const daysSince = (Date.now() - new Date(lastReviewedAt).getTime()) / DAY_MS;
  if (daysSince < STALE_DAYS) return null;

  return (
    <div className="flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
      <div className="flex-1 text-xs">
        Your last review was {relativeTime(lastReviewedAt)}, let&rsquo;s catch up.
      </div>
      <Button
        size="sm"
        onClick={handleReview}
        disabled={startingMode !== null}
        className="bg-amber-600 border-amber-700 text-white shadow-[inset_0_-1px_0_0_oklch(0.48_0.13_60/0.5),0_1px_2px_0_rgb(0_0_0/0.12)]! hover:bg-amber-700 hover:border-amber-800 dark:bg-amber-500 dark:border-amber-600 dark:text-amber-950 dark:shadow-[inset_0_-1px_0_0_oklch(0.52_0.15_60/0.5),0_1px_2px_-1px_rgb(0_0_0/0.35)]! dark:hover:bg-amber-400 dark:hover:border-amber-500"
      >
        {startingMode === "due" && <Spinner className="size-3" />}
        Review
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-amber-900/70 hover:bg-transparent hover:text-amber-900 dark:text-amber-200/70 dark:hover:bg-transparent dark:hover:text-amber-200"
              onClick={handleDismiss}
              aria-label="Dismiss"
            >
              <IconX />
            </Button>
          }
        />
        <TooltipContent>Dismiss for 24 hours</TooltipContent>
      </Tooltip>

      <ReviewConfirmDialog
        open={confirmOpen}
        onOpenChange={handleConfirmOpenChange}
        mode="due"
        cardCount={data.dueCount}
        itemCount={data.dueItemCount}
        onConfirm={handleConfirm}
        isStarting={isStarting}
      />
    </div>
  );
};
