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
import { type DbTag } from "@/lib/types";

type DeleteTagDialogProps = {
  tag: DbTag | null;
  itemCount: number;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export const DeleteTagDialog = ({
  tag,
  itemCount,
  deleting,
  onOpenChange,
  onConfirm,
}: DeleteTagDialogProps) => {
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (deleting) return;
      if (!next) onOpenChange(false);
    },
    [onOpenChange, deleting],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (deleting) return;
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
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
    <AlertDialog open={tag !== null} onOpenChange={handleOpenChange}>
      <AlertDialogContent onKeyDown={handleKeyDown}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete tag</AlertDialogTitle>
          <AlertDialogDescription>
            {tag && (
              <>
                This will remove{" "}
                <span className="font-medium">{tag.name}</span> from{" "}
                {itemCount} {itemCount === 1 ? "item" : "items"}.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
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
