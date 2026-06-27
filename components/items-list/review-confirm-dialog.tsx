"use client";

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
  onConfirm: () => void;
  isStarting: boolean;
}) => {
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
        <AlertDialogFooter>
          {isEmpty ? (
            <AlertDialogCancel>OK</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel disabled={isStarting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm} disabled={isStarting}>
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
