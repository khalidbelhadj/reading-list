import {
  IconEdit,
  IconEye,
  IconEyeOff,
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
  if (!item) return null;

  const isRead = isReadingListItem(item) && item.read;

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
            onClick={() => {
              onOpenChange(false);
              onEdit();
            }}
          >
            <IconEdit className="size-4 text-muted-foreground" />
            Edit
          </button>
          {onToggleRead && (
            <button
              type="button"
              className="flex items-center gap-3 px-4 py-3 text-sm text-foreground rounded-md active:bg-accent"
              onClick={() => {
                onOpenChange(false);
                onToggleRead(!isRead);
              }}
            >
              {isRead ? (
                <IconEyeOff className="size-4 text-muted-foreground" />
              ) : (
                <IconEye className="size-4 text-muted-foreground" />
              )}
              {isRead ? "Mark as unread" : "Mark as read"}
            </button>
          )}
          <button
            type="button"
            className="flex items-center gap-3 px-4 py-3 text-sm text-destructive rounded-md active:bg-accent"
            onClick={() => {
              onOpenChange(false);
              onDelete();
            }}
          >
            <IconTrash className="size-4" />
            Delete
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
