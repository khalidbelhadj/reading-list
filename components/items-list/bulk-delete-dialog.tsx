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
import { type Item } from "@/lib/types";
import { isModKey } from "@/lib/input-context";

type BulkDeleteDialogProps = {
  items: Item[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export const BulkDeleteDialog = ({
  items,
  open,
  onOpenChange,
  onConfirm,
}: BulkDeleteDialogProps) => {
  const flashcardCount = items.reduce(
    (sum, item) => sum + item.flashcardCount,
    0,
  );

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) onOpenChange(false);
    },
    [onOpenChange],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && isModKey(e)) {
        e.preventDefault();
        onConfirm();
      }
    },
    [onConfirm],
  );

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onConfirm();
    },
    [onConfirm],
  );

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent onKeyDown={handleKeyDown}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {items.length} {items.length === 1 ? "item" : "items"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {flashcardCount > 0 ? (
              <>
                This will also delete{" "}
                <span className="font-medium">{flashcardCount}</span>{" "}
                {flashcardCount === 1 ? "flashcard" : "flashcards"}. This action
                cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to delete the selected items? This action
                cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleClick}>
            Delete {items.length === 1 ? "item" : `${items.length} items`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
