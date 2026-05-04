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
  const title = isCram
    ? "Start cram session?"
    : isNew
      ? "Start new cards session?"
      : "Start review?";
  const summary =
    cardCount === 0
      ? isNew
        ? "There are no new cards to review."
        : "There are no cards to review."
      : `${pluralize(cardCount, "card")} available across ${pluralize(
          itemCount,
          "item",
        )}.`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {summary}
            {cardCount > 0 && isCram && (
              <> Cram sessions don&rsquo;t affect your schedule.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {cardCount > 1 && (
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
          <AlertDialogCancel disabled={isStarting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(plannedCount)}
            disabled={isStarting || plannedCount === 0}
          >
            {isStarting && <Spinner className="size-3" />}
            {isCram ? "Start cram" : isNew ? "Start new cards" : "Start review"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
