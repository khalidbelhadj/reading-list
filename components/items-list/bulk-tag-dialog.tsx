import React from "react";
import { type QueryClient } from "@tanstack/react-query";

import { bulkTag } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BulkTagDialog({
  open,
  onOpenChange,
  selectedIds,
  queryClient,
  setPendingActions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
  queryClient: QueryClient;
  setPendingActions: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [tagInput, setTagInput] = React.useState("");

  // Reset input when dialog opens
  React.useEffect(() => {
    if (open) setTagInput("");
  }, [open]);

  function applyTags() {
    const tagNames = tagInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (tagNames.length > 0) {
      const ids = Array.from(selectedIds);
      setPendingActions((n) => n + 1);
      bulkTag(ids, tagNames).then(() => queryClient.invalidateQueries({ queryKey: ["items"] })).finally(() => setPendingActions((n) => n - 1));
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-3 p-3 sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Tag {selectedIds.size} items</DialogTitle>
        </DialogHeader>
        <input
          autoFocus
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="tag1, tag2, ..."
          className="w-full rounded-md border border-input bg-input/20 px-2 py-1.5 text-xs outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              applyTags();
            }
          }}
        />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={applyTags}>
            Add tags
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
