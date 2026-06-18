"use client";

import React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ReviewMode } from "@/app/actions";

const DEFAULT_LIMIT = 5;
const SECONDS_PER_CARD = 30;
const PRESETS = [5, 10, 20];

const pluralize = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
};

const buildPresets = (cardCount: number) => {
  const filtered = PRESETS.filter((preset) => preset < cardCount);
  return [...filtered, cardCount];
};

export const ReviewConfirmDialog = ({
  open,
  onOpenChange,
  mode,
  cardCount,
  itemCount,
  itemScoped = false,
  onConfirm,
  isStarting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ReviewMode | null;
  cardCount: number;
  itemCount: number;
  itemScoped?: boolean;
  onConfirm: (limit: number) => void;
  isStarting: boolean;
}) => {
  const initialLimit = Math.min(DEFAULT_LIMIT, Math.max(cardCount, 1));
  const [limit, setLimit] = React.useState(initialLimit);

  React.useEffect(() => {
    if (open) setLimit(Math.min(DEFAULT_LIMIT, Math.max(cardCount, 1)));
  }, [open, cardCount]);

  const plannedCount = Math.min(limit, cardCount);
  const presets = React.useMemo(() => buildPresets(cardCount), [cardCount]);

  const isCram = mode === "cram";
  const isNew = mode === "new";
  const isEmpty = cardCount === 0;

  const title = isEmpty
    ? isNew
      ? "No new cards"
      : isCram
        ? "No cards to cram"
        : "No cards due"
    : isCram
      ? "Start cram session?"
      : isNew
        ? "Start new cards session?"
        : "Start review?";

  const description = isEmpty
    ? isNew
      ? itemScoped
        ? "All of this item’s cards have been introduced."
        : "All your cards have been introduced. New cards will appear as you add flashcards to items."
      : isCram
        ? itemScoped
          ? "This item has no flashcards yet."
          : "There are no flashcards yet. Add flashcards to your items to start cramming."
        : itemScoped
          ? "None of this item’s cards are due right now."
          : "You’re all caught up! Cards will become due again as their review intervals expire."
    : itemScoped
      ? isNew
        ? `${pluralize(cardCount, "new card")} in this item.`
        : isCram
          ? `${pluralize(cardCount, "card")} in this item.`
          : `${pluralize(cardCount, "card")} due in this item.`
      : `${pluralize(cardCount, "card")} due across ${pluralize(itemCount, "item")}.`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
            {!isEmpty && isCram && (
              <> Cram sessions don&rsquo;t affect your schedule.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!isEmpty && cardCount > 1 && (
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => {
              const isAll = preset === cardCount;
              const isSelected = plannedCount === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLimit(preset)}
                  disabled={isStarting}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-md px-4 py-3 text-left transition-colors disabled:opacity-50",
                    // Translucent tints rather than --secondary/--muted —
                    // those tokens are identical in dark mode so the
                    // selected tile was indistinguishable from the others.
                    isSelected
                      ? "bg-foreground/15"
                      : "bg-foreground/5 hover:bg-foreground/10",
                  )}
                >
                  <span className="font-content text-2xl tabular-nums">
                    ~{formatDuration(preset * SECONDS_PER_CARD)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isAll ? `All ${preset} cards` : `${preset} cards`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {!isEmpty && cardCount === 1 && (
          <div className="text-xs text-muted-foreground">
            Estimated time: ~{formatDuration(SECONDS_PER_CARD)}
          </div>
        )}
        <AlertDialogFooter>
          {isEmpty ? (
            <AlertDialogCancel>OK</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel disabled={isStarting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onConfirm(plannedCount)}
                disabled={isStarting}
              >
                {isStarting && <Spinner className="size-3" />}
                {isCram
                  ? "Start cram"
                  : isNew
                    ? "Start new cards"
                    : "Start review"}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
