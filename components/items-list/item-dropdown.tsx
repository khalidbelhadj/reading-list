import {
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconMessage,
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
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [copyTriggered, setCopyTriggered] = React.useState(false);
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  // Reset copy-triggered when the menu closes.
  React.useEffect(() => {
    if (!open) setCopyTriggered(false);
  }, [open]);

  // Once copy has been clicked, watch the cursor globally. Start a 3s timer
  // when the cursor is outside the popup's bounding rect; cancel when inside.
  // Using global mousemove + hit-testing is more reliable than mouseenter/leave
  // which fire on every wobble across the popup boundary.
  React.useEffect(() => {
    if (!open || !copyTriggered) return;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const cancel = () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    };
    const start = () => {
      cancel();
      timerId = setTimeout(() => {
        onOpenChangeRef.current?.(false);
      }, AUTO_CLOSE_MS);
    };

    const handleMove = (e: MouseEvent) => {
      const popup = document.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-content"]',
      );
      if (!popup) return;
      const rect = popup.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (inside) cancel();
      else if (!timerId) start();
    };

    // Kick off the timer assuming cursor is currently inside (it just clicked).
    // The next mousemove will either confirm inside (cancel) or detect outside
    // (start a fresh timer).
    document.addEventListener("mousemove", handleMove);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      cancel();
    };
  }, [open, copyTriggered]);

  const handleCopyMarkdown = React.useCallback(() => {
    navigator.clipboard.writeText(`[${item.title}](${item.url})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setCopyTriggered(true);
  }, [item.title, item.url]);

  const handleCopyPrompt = React.useCallback(() => {
    const lines = [
      `We're going to focus on this item from my reading list:`,
      ``,
      `- Title: ${item.title}`,
    ];
    if (item.url.trim()) lines.push(`- URL: ${item.url}`);
    lines.push(`- Item ID: ${item.id}`);
    if (item.notes?.trim()) {
      lines.push(``, `Existing notes:`, item.notes.trim());
    }
    lines.push(
      ``,
      `Start by reading the URL and (if possible) giving me a quick, concise summary of the key ideas — keep it brief. From there we'll have a discussion — asking questions, extracting information, structuring thoughts — to round out my understanding of this item.`,
      ``,
      `Whenever we hit a key point, a revelation, or reach a solid understanding of something worth remembering, propose a flashcard and (with my go-ahead) save it via create_flashcard using the item ID above. You can also append anything worth keeping to the item's notes via update_item.`,
    );
    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 1500);
    setCopyTriggered(true);
  }, [item.id, item.title, item.url, item.notes]);

  const isRead = isReadingListItem(item) && item.read;

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {children}
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem closeOnClick={false} onClick={handleCopyMarkdown}>
          {copied ? <IconCheck /> : <IconCopy />}
          Copy as Markdown link
        </DropdownMenuItem>
        <DropdownMenuItem closeOnClick={false} onClick={handleCopyPrompt}>
          {copiedPrompt ? <IconCheck /> : <IconMessage />}
          Copy prompt
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
