import { IconFileFilled } from "@tabler/icons-react";
import React from "react";

import { getFaviconSrc } from "@/components/items-list/utils";
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
import Image from "@/components/ui/image";
import { isModKey } from "@/lib/input-context";
import { type Item } from "@/lib/types";

// One confirm dialog for both delete flows. Single mode (`item`) shows the
// item's favicon/title preview and single-item copy; bulk mode (`items`)
// counts the selection in the title and confirm button.
type DeleteItemsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
} & ({ item: Item | null; items?: never } | { items: Item[]; item?: never });

export const DeleteItemsDialog = ({
  item,
  items,
  open,
  onOpenChange,
  onConfirm,
}: DeleteItemsDialogProps) => {
  const single = items === undefined;
  const targets = items ?? (item ? [item] : []);
  const flashcardCount = targets.reduce(
    (sum, target) => sum + target.flashcardCount,
    0,
  );
  const faviconSrc = item ? getFaviconSrc(item) : null;

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
            {single
              ? "Delete item"
              : `Delete ${targets.length} ${targets.length === 1 ? "item" : "items"}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {flashcardCount > 0 ? (
              <>
                This will also delete{" "}
                <span className="font-medium">{flashcardCount}</span>{" "}
                {flashcardCount === 1 ? "flashcard" : "flashcards"}. This action
                cannot be undone.
              </>
            ) : single ? (
              <>
                Are you sure you want to delete this item? This action cannot be
                undone.
              </>
            ) : (
              <>
                Are you sure you want to delete the selected items? This action
                cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {single && item && (
          <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-md bg-card px-1 py-1 ring-1 ring-foreground/5">
            <div className="flex size-5 shrink-0 items-center justify-center">
              {faviconSrc ? (
                <Image
                  src={faviconSrc}
                  alt=""
                  width={20}
                  height={20}
                  className="size-5 rounded"
                  unoptimized
                />
              ) : (
                <IconFileFilled className="size-5 text-muted-foreground" />
              )}
            </div>
            <span className="truncate font-content text-sm">
              {item.title || "Untitled"}
            </span>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleClick}>
            {single
              ? "Delete"
              : `Delete ${targets.length === 1 ? "item" : `${targets.length} items`}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
