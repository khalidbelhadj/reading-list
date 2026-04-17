import {
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconTrash,
} from "@tabler/icons-react";
import React from "react";

import { type Item, isReadingListItem } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const AUTO_CLOSE_MS = 3000;

export const ItemDropdown = ({
  item,
  open,
  onOpenChange,
  onToggleRead,
  onDelete,
  children,
}: {
  item: Item;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onToggleRead?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}) => {
  const [copied, setCopied] = React.useState(false);
  const copyTriggeredRef = React.useRef(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  const cancelCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const startCloseTimer = React.useCallback(() => {
    cancelCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      onOpenChangeRef.current?.(false);
      closeTimerRef.current = null;
    }, AUTO_CLOSE_MS);
  }, [cancelCloseTimer]);

  // Reset on close + cleanup on unmount
  React.useEffect(() => {
    if (!open) {
      copyTriggeredRef.current = false;
      cancelCloseTimer();
    }
  }, [open, cancelCloseTimer]);
  React.useEffect(() => () => cancelCloseTimer(), [cancelCloseTimer]);

  const handleCopyMarkdown = React.useCallback(() => {
    navigator.clipboard.writeText(`[${item.title}](${item.url})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    copyTriggeredRef.current = true;
  }, [item.title, item.url]);

  const isRead = isReadingListItem(item) && item.read;

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {children}
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={cancelCloseTimer}
        onMouseLeave={() => {
          if (copyTriggeredRef.current) startCloseTimer();
        }}
      >
        <DropdownMenuItem closeOnClick={false} onClick={handleCopyMarkdown}>
          {copied ? <IconCheck /> : <IconCopy />}
          Copy as Markdown link
        </DropdownMenuItem>
        {onToggleRead && isReadingListItem(item) && (
          <DropdownMenuItem onClick={() => onToggleRead()}>
            {isRead ? <IconEyeOff /> : <IconEye />}
            {isRead ? "Mark as unread" : "Mark as read"}
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete()}>
            <IconTrash />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
