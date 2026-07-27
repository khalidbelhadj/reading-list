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
import { type DuplicateItem } from "@/lib/url";

import { Favicon } from "./favicon";

export const DuplicateDialog = ({
  open,
  onOpenChange,
  existing,
  onOpenExisting,
  onCreateAnyway,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: DuplicateItem | null;
  onOpenExisting: () => void;
  onCreateAnyway: () => void;
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Item already exists</AlertDialogTitle>
          <AlertDialogDescription>
            An item with this URL is already in your list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {existing && (
          <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-md bg-muted/50 px-2 py-1.5 text-xs">
            <div className="flex size-4 shrink-0 items-center justify-center">
              <Favicon item={existing} className="size-4" />
            </div>
            <span className="truncate">{existing.title || existing.url}</span>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="outline" onClick={onCreateAnyway}>
            Create anyway
          </AlertDialogAction>
          <AlertDialogAction onClick={onOpenExisting}>
            Open existing
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
