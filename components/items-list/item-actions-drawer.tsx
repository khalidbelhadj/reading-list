import React from "react";
import {
  IconEdit,
  IconCircle,
  IconCircleCheckFilled,
  IconTrash,
} from "@tabler/icons-react";

import { type Item, isReadingListItem } from "@/lib/types";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export function ItemActionsDrawer({
  item,
  open,
  onOpenChange,
  onEdit,
  onToggleRead,
  onDelete,
}: {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onToggleRead?: (read: boolean) => void;
  onDelete: () => void;
}) {
  const isRead = item && isReadingListItem(item) && item.read;

  const handleEdit = React.useCallback(() => {
    onOpenChange(false);
    onEdit();
  }, [onOpenChange, onEdit]);

  const handleToggleReadClick = React.useCallback(() => {
    onOpenChange(false);
    if (onToggleRead) onToggleRead(!isRead);
  }, [onOpenChange, onToggleRead, isRead]);

  const handleDelete = React.useCallback(() => {
    onOpenChange(false);
    onDelete();
  }, [onOpenChange, onDelete]);

  if (!item) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="truncate">{item.title || "Untitled"}</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col px-2 pb-4">
          <button
            type="button"
            className="flex items-center gap-3 px-4 py-3 text-sm text-foreground rounded-md active:bg-accent"
            onClick={handleEdit}
          >
            <IconEdit className="size-4 text-muted-foreground" />
            Edit
          </button>
          {onToggleRead && (
            <button
              type="button"
              className="flex items-center gap-3 px-4 py-3 text-sm text-foreground rounded-md active:bg-accent"
              onClick={handleToggleReadClick}
            >
              {isRead ? (
                <IconCircleCheckFilled className="size-4 text-muted-foreground" />
              ) : (
                <IconCircle className="size-4 text-muted-foreground" />
              )}
              {isRead ? "Mark as unread" : "Mark as read"}
            </button>
          )}
          <button
            type="button"
            className="flex items-center gap-3 px-4 py-3 text-sm text-destructive rounded-md active:bg-accent"
            onClick={handleDelete}
          >
            <IconTrash className="size-4" />
            Delete
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
