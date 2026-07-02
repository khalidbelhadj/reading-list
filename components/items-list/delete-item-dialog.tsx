import React from "react";
import Image from "@/components/ui/image";
import { IconFileFilled } from "@tabler/icons-react";

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
import { type Item } from "@/lib/types";
import { isModKey } from "@/lib/input-context";
import { getFaviconSrc } from "@/components/items-list/utils";

type DeleteItemDialogProps = {
  item: Item | null;
  open: boolean;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export const DeleteItemDialog = ({
  item,
  open,
  deleting,
  onOpenChange,
  onConfirm,
}: DeleteItemDialogProps) => {
  const faviconSrc = item ? getFaviconSrc(item) : null;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) onOpenChange(false);
    },
    [onOpenChange],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && isModKey(e) && !deleting) {
        e.preventDefault();
        onConfirm();
      }
    },
    [onConfirm, deleting],
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
          <AlertDialogTitle>Delete item</AlertDialogTitle>
          <AlertDialogDescription>
            {item && item.flashcardCount > 0 ? (
              <>
                This will also delete{" "}
                <span className="font-medium">{item.flashcardCount}</span>{" "}
                {item.flashcardCount === 1 ? "flashcard" : "flashcards"}. This
                action cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to delete this item? This action cannot be
                undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {item && (
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
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={handleClick}
          >
            {deleting && <Spinner className="size-3.5" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
