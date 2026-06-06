import React from "react";
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconPin,
  IconPinnedOff,
  IconTrash,
} from "@tabler/icons-react";

import { IconClaude } from "@/components/ui/claude-icon";
import { type Item } from "@/lib/types";
import { stripBlankLineSentinel } from "@/lib/markdown";
import {
  ContextMenu as ContextMenuRoot,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const AUTO_CLOSE_MS = 3000;

// Track-cursor-and-auto-close behaviour shared between the dropdown and the
// context menu — once the user clicks copy, we start a 3s timer when their
// cursor leaves the popup, and cancel when it re-enters. Using global
// mousemove + hit-testing is more reliable than mouseenter/leave which fires
// on every wobble across the popup boundary.
const useAutoCloseAfterCopy = ({
  open,
  copyTriggered,
  onClose,
}: {
  open: boolean;
  copyTriggered: boolean;
  onClose: () => void;
}) => {
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });
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
        onCloseRef.current();
      }, AUTO_CLOSE_MS);
    };

    const handleMove = (e: MouseEvent) => {
      const popups = document.querySelectorAll<HTMLElement>(
        '[data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-sub-content"], [data-slot="context-menu-content"]',
      );
      if (popups.length === 0) return;
      const inside = Array.from(popups).some((popup) => {
        const rect = popup.getBoundingClientRect();
        return (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        );
      });
      if (inside) cancel();
      else if (!timerId) start();
    };

    document.addEventListener("mousemove", handleMove);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      cancel();
    };
  }, [open, copyTriggered]);
};

type ItemMenuActionsProps = {
  item: Item;
  onTogglePin?: () => void;
  onToggleRead?: () => void;
  onDelete?: () => void;
};

// Internal hook returning the action handlers + visible-state needed to render
// the menu items. Used by both ItemDropdown and ItemContextMenu so the copy
// feedback behaviour stays consistent across both entry points.
const useItemMenuActions = ({ item }: { item: Item }) => {
  const [lastCopied, setLastCopied] = React.useState<string | null>(null);
  const [copyTriggered, setCopyTriggered] = React.useState(false);

  const handleCopyId = React.useCallback(() => {
    navigator.clipboard.writeText(item.id);
    setLastCopied("__id__");
    setTimeout(() => setLastCopied(null), 2000);
    setCopyTriggered(true);
  }, [item.id]);

  const handleCopyTitle = React.useCallback(() => {
    navigator.clipboard.writeText(item.title);
    setLastCopied("__title__");
    setTimeout(() => setLastCopied(null), 2000);
    setCopyTriggered(true);
  }, [item.title]);

  const handleCopyNotes = React.useCallback(() => {
    if (!item.notes) return;
    navigator.clipboard.writeText(stripBlankLineSentinel(item.notes));
    setLastCopied("__notes__");
    setTimeout(() => setLastCopied(null), 2000);
    setCopyTriggered(true);
  }, [item.notes]);

  const handleOpenInNewTab = React.useCallback(() => {
    window.open(item.url, "_blank", "noopener,noreferrer");
  }, [item.url]);

  const handleChatWithClaude = React.useCallback(() => {
    const lines = ["This is an item from my reading list:", ""];
    lines.push(`- **ID:** ${item.id}`);
    if (item.title) lines.push(`- **Title:** ${item.title}`);
    if (item.url) lines.push(`- **URL:** ${item.url}`);
    if (item.notes)
      lines.push("", "**Notes:**", "", stripBlankLineSentinel(item.notes));
    const prompt = lines.join("\n");
    window.open(
      `claude://claude.ai/new?q=${encodeURIComponent(prompt)}`,
      "_self",
    );
  }, [item.id, item.title, item.url, item.notes]);

  const canOpenUrl = !!item.url && URL.canParse(item.url);
  const hasNotes =
    !!item.notes && stripBlankLineSentinel(item.notes).trim().length > 0;

  return {
    lastCopied,
    copyTriggered,
    setCopyTriggered,
    handleCopyId,
    handleCopyTitle,
    handleCopyNotes,
    handleOpenInNewTab,
    handleChatWithClaude,
    canOpenUrl,
    hasNotes,
  };
};

// Renders just the menu items (no Root/Popup/Content wrapper). Both the
// dropdown and context-menu wrappers use the same MenuPrimitive.Item under
// the hood (ContextMenuRoot creates Menu.Root internally), so DropdownMenu*
// items render correctly inside either context.
const ItemMenuItems = ({
  item,
  canOpenUrl,
  hasNotes,
  lastCopied,
  handleOpenInNewTab,
  handleChatWithClaude,
  handleCopyId,
  handleCopyTitle,
  handleCopyNotes,
  onTogglePin,
  onToggleRead,
  onDelete,
}: ItemMenuActionsProps & ReturnType<typeof useItemMenuActions>) => {
  const isRead = item.read;

  return (
    <>
      {canOpenUrl && (
        <OpenInNewTabItem
          url={item.url ?? ""}
          onOpen={handleOpenInNewTab}
        />
      )}
      {onTogglePin && (
        <DropdownMenuItem onClick={onTogglePin}>
          {item.starred ? <IconPinnedOff /> : <IconPin />}
          {item.starred ? "Unpin" : "Pin"}
        </DropdownMenuItem>
      )}
      <Tooltip open={lastCopied === "__title__"}>
        <TooltipTrigger
          render={
            <DropdownMenuItem closeOnClick={false} onClick={handleCopyTitle}>
              <IconCopy />
              Copy title
            </DropdownMenuItem>
          }
        />
        <TooltipContent side="right">Copied</TooltipContent>
      </Tooltip>
      <Tooltip open={lastCopied === "__id__"}>
        <TooltipTrigger
          render={
            <DropdownMenuItem closeOnClick={false} onClick={handleCopyId}>
              <IconCopy />
              Copy ID
            </DropdownMenuItem>
          }
        />
        <TooltipContent side="right">Copied</TooltipContent>
      </Tooltip>
      {hasNotes && (
        <Tooltip open={lastCopied === "__notes__"}>
          <TooltipTrigger
            render={
              <DropdownMenuItem closeOnClick={false} onClick={handleCopyNotes}>
                <IconCopy />
                Copy notes as Markdown
              </DropdownMenuItem>
            }
          />
          <TooltipContent side="right">Copied</TooltipContent>
        </Tooltip>
      )}
      <DropdownMenuItem onClick={handleChatWithClaude}>
        <IconClaude />
        Chat with Claude
      </DropdownMenuItem>
      {onToggleRead && (
        <DropdownMenuItem onClick={onToggleRead}>
          {isRead ? <IconEyeOff /> : <IconEye />}
          {isRead ? "Mark as unread" : "Mark as read"}
        </DropdownMenuItem>
      )}
      {onDelete && (
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <IconTrash />
          Delete
        </DropdownMenuItem>
      )}
    </>
  );
};

export const ItemDropdown = ({
  item,
  open,
  onOpenChange,
  onTogglePin,
  onToggleRead,
  onDelete,
  children,
}: {
  item: Item;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onTogglePin?: () => void;
  onToggleRead?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}) => {
  const actions = useItemMenuActions({ item });

  React.useEffect(() => {
    if (!open) actions.setCopyTriggered(false);
  }, [open, actions]);

  useAutoCloseAfterCopy({
    open: !!open,
    copyTriggered: actions.copyTriggered,
    onClose: () => onOpenChange?.(false),
  });

  const handleStopPropagation = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {children}
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        onClick={handleStopPropagation}
      >
        <ItemMenuItems
          item={item}
          onTogglePin={onTogglePin}
          onToggleRead={onToggleRead}
          onDelete={onDelete}
          {...actions}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const ItemContextMenu = ({
  item,
  onTogglePin,
  onToggleRead,
  onDelete,
  onOpenChange,
  children,
}: {
  item: Item;
  onTogglePin?: () => void;
  onToggleRead?: () => void;
  onDelete?: () => void;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  const [open, setOpenState] = React.useState(false);
  const actions = useItemMenuActions({ item });

  const setOpen = React.useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  React.useEffect(() => {
    if (!open) actions.setCopyTriggered(false);
  }, [open, actions]);

  useAutoCloseAfterCopy({
    open,
    copyTriggered: actions.copyTriggered,
    onClose: () => setOpen(false),
  });

  return (
    <ContextMenuRoot open={open} onOpenChange={setOpen}>
      {children}
      <ContextMenuContent>
        <ItemMenuItems
          item={item}
          onTogglePin={onTogglePin}
          onToggleRead={onToggleRead}
          onDelete={onDelete}
          {...actions}
        />
      </ContextMenuContent>
    </ContextMenuRoot>
  );
};

export { ContextMenuTrigger as ItemContextMenuTrigger };

const OpenInNewTabItem = ({
  url,
  onOpen,
}: {
  url: string;
  onOpen: () => void;
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [url],
  );

  const stopPointerDown = React.useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <DropdownMenuItem onClick={onOpen} className="group/open-tab pr-1">
      <IconExternalLink />
      <span className="flex-1">Open URL</span>
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy URL"}
        onPointerDown={stopPointerDown}
        onClick={handleCopyClick}
        className="ml-1 flex size-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-secondary group-hover/open-tab:opacity-100 focus-visible:opacity-100"
      >
        {copied ? <IconCheck /> : <IconCopy />}
      </button>
    </DropdownMenuItem>
  );
};
