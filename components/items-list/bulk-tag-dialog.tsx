import React from "react";

import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

export function BulkTagDialog({
  open,
  onOpenChange,
  selectedIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
}) {
  const [tagInput, setTagInput] = React.useState("");
  const store = useStore();

  // Reset input when dialog opens
  React.useEffect(() => {
    if (open) setTagInput("");
  }, [open]);

  function applyTags() {
    const tagNames = tagInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (tagNames.length > 0) {
      const ids = Array.from(selectedIds);
      store.bulkTag(ids, tagNames);
    }
    onOpenChange(false);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent showCloseButton={false} className="gap-3 p-3 sm:max-w-xs">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Tag {selectedIds.size} items</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
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
        <ResponsiveDialogFooter>
          <ResponsiveDialogClose render={<Button variant="outline" />}>
            Cancel
          </ResponsiveDialogClose>
          <Button onClick={applyTags}>
            Add tags
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
