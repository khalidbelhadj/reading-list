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
import type { ReviewMode } from "@/app/actions";

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
  onConfirm: () => void;
  isStarting: boolean;
}) => {
  const isCram = mode === "cram";
  const title = isCram ? "Start cram session?" : "Start review?";
  const summary =
    cardCount === 0
      ? "There are no cards to review."
      : `You're about to ${isCram ? "cram" : "review"} ${pluralize(
          cardCount,
          "card",
        )} from ${pluralize(itemCount, "item")}.`;

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
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isStarting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isStarting || cardCount === 0}
          >
            {isStarting && <Spinner className="size-3" />}
            {isCram ? "Start cram" : "Start review"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
