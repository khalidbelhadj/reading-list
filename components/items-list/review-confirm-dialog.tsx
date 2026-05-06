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
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import type { ReviewMode } from "@/app/actions";

const DEFAULT_LIMIT = 5;

const pluralize = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export const ReviewConfirmDialog = ({
  open,
  onOpenChange,
  mode,
  cardCount,
  itemCount,
  onConfirm,
  isStarting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ReviewMode | null;
  cardCount: number;
  itemCount: number;
  onConfirm: (limit: number) => void;
  isStarting: boolean;
}) => {
  const initialLimit = Math.min(DEFAULT_LIMIT, Math.max(cardCount, 1));
  const [limit, setLimit] = React.useState(initialLimit);

  React.useEffect(() => {
    if (open) setLimit(Math.min(DEFAULT_LIMIT, Math.max(cardCount, 1)));
  }, [open, cardCount]);

  const plannedCount = Math.min(limit, cardCount);

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
      ? "All your cards have been introduced. New cards will appear as you add flashcards to items."
      : isCram
        ? "There are no flashcards yet. Add flashcards to your items to start cramming."
        : "You’re all caught up! Cards will become due again as their review intervals expire."
    : `${pluralize(cardCount, "card")} available across ${pluralize(itemCount, "item")}.`;

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
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Cards for this session</span>
              <span className="tabular-nums text-muted-foreground">
                {plannedCount}
              </span>
            </div>
            <Slider
              min={1}
              max={cardCount}
              value={[plannedCount]}
              onValueChange={(values) => {
                const next = Array.isArray(values) ? values[0] : values;
                if (typeof next === "number") setLimit(next);
              }}
              disabled={isStarting}
            />
          </div>
        )}
        <AlertDialogFooter>
          {isEmpty ? (
            <AlertDialogCancel>OK</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel disabled={isStarting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onConfirm(plannedCount)}
                disabled={isStarting}
              >
                {isStarting && <Spinner className="size-3" />}
                {isCram ? "Start cram" : isNew ? "Start new cards" : "Start review"}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
