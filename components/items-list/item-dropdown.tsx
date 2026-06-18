import {
  IconBolt,
  IconCalendarDue,
  IconCards,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconPin,
  IconPinnedOff,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { getItemReviewStatus, type ReviewMode } from "@/app/actions";
import { IconClaude } from "@/components/ui/claude-icon";
import {
  ContextMenuContent,
  ContextMenu as ContextMenuRoot,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { openChatWithClaude } from "@/lib/chat-with-claude";
import { stripBlankLineSentinel } from "@/lib/markdown";
import { type Item } from "@/lib/types";
import { ReviewConfirmDialog } from "./review-confirm-dialog";
import { useStartReview } from "./use-start-review";

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

// Item-scoped review sessions launched from the menu. Counts are fetched
// lazily when the menu opens (per-item due/new counts aren't part of the
// items query) and the confirm dialog lives outside the menu popup so it
// survives the menu closing.
const useItemReview = ({
  item,
  menuOpen,
}: {
  item: Item;
  menuOpen: boolean;
}) => {
  const hasCards = item.flashcardCount > 0;
  const { data: reviewStatus } = useQuery({
    queryKey: ["item-review-status", item.id],
    queryFn: () => getItemReviewStatus(item.id),
    enabled: menuOpen && hasCards,
  });
  const { startingMode, startReview } = useStartReview();
  const isStarting = startingMode !== null;
  const [pendingMode, setPendingMode] = React.useState<ReviewMode | null>(null);

  const handleDueClick = React.useCallback(() => setPendingMode("due"), []);
  const handleNewClick = React.useCallback(() => setPendingMode("new"), []);
  const handleCramClick = React.useCallback(() => setPendingMode("cram"), []);

  const handleDialogOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && !isStarting) setPendingMode(null);
    },
    [isStarting],
  );

  const handleConfirm = React.useCallback(
    (limit: number) => {
      if (!pendingMode) return;
      startReview(pendingMode, limit, { itemId: item.id });
    },
    [pendingMode, startReview, item.id],
  );

  const wasStartingRef = React.useRef(false);
  React.useEffect(() => {
    if (wasStartingRef.current && !isStarting && pendingMode !== null) {
      setPendingMode(null);
    }
    wasStartingRef.current = isStarting;
  }, [isStarting, pendingMode]);

  const dialogCardCount =
    pendingMode === "cram"
      ? (reviewStatus?.totalCardCount ?? item.flashcardCount)
      : pendingMode === "new"
        ? (reviewStatus?.newCount ?? 0)
        : (reviewStatus?.dueCount ?? 0);

  return {
    hasCards,
    reviewStatus,
    cramCount: reviewStatus?.totalCardCount ?? item.flashcardCount,
    pendingMode,
    isStarting,
    handleDueClick,
    handleNewClick,
    handleCramClick,
    handleDialogOpenChange,
    handleConfirm,
    dialogCardCount,
  };
};

type ItemReviewState = ReturnType<typeof useItemReview>;

const ItemReviewDialog = ({ review }: { review: ItemReviewState }) => (
  <ReviewConfirmDialog
    open={review.pendingMode !== null}
    onOpenChange={review.handleDialogOpenChange}
    mode={review.pendingMode}
    cardCount={review.dialogCardCount}
    itemCount={1}
    itemScoped
    onConfirm={review.handleConfirm}
    isStarting={review.isStarting}
  />
);

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
    openChatWithClaude(item);
  }, [item]);

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
  review,
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
}: ItemMenuActionsProps &
  ReturnType<typeof useItemMenuActions> & { review: ItemReviewState }) => {
  const isRead = item.read;

  return (
    <>
      {canOpenUrl && (
        <OpenInNewTabItem url={item.url ?? ""} onOpen={handleOpenInNewTab} />
      )}
      {onTogglePin && (
        <DropdownMenuItem onClick={onTogglePin}>
          {item.starred ? <IconPinnedOff /> : <IconPin />}
          {item.starred ? "Unpin" : "Pin"}
        </DropdownMenuItem>
      )}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <IconCopy />
          Copy
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <Tooltip open={lastCopied === "__title__"}>
            <TooltipTrigger
              render={
                <DropdownMenuItem
                  closeOnClick={false}
                  onClick={handleCopyTitle}
                >
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
                  <DropdownMenuItem
                    closeOnClick={false}
                    onClick={handleCopyNotes}
                  >
                    <IconCopy />
                    Copy notes as Markdown
                  </DropdownMenuItem>
                }
              />
              <TooltipContent side="right">Copied</TooltipContent>
            </Tooltip>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {review.hasCards && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconCards />
            Review
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              disabled={
                !review.reviewStatus || review.reviewStatus.dueCount === 0
              }
              onClick={review.handleDueClick}
            >
              <IconCalendarDue />
              Due
              {review.reviewStatus && (
                <span className="ml-auto pl-3 text-muted-foreground tabular-nums">
                  {review.reviewStatus.dueCount}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={
                !review.reviewStatus || review.reviewStatus.newCount === 0
              }
              onClick={review.handleNewClick}
            >
              <IconSparkles />
              New cards
              {review.reviewStatus && (
                <span className="ml-auto pl-3 text-muted-foreground tabular-nums">
                  {review.reviewStatus.newCount}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={review.handleCramClick}>
              <IconBolt />
              Cram
              <span className="ml-auto pl-3 text-muted-foreground tabular-nums">
                {review.cramCount}
              </span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
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

  // Some call sites leave the dropdown uncontrolled (no `open` prop), but the
  // review submenu needs to know when the menu opens to lazily fetch counts —
  // so mirror the open state internally and resolve to whichever is in charge.
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setInternalOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const review = useItemReview({ item, menuOpen: isOpen });

  React.useEffect(() => {
    if (!isOpen) actions.setCopyTriggered(false);
  }, [isOpen, actions]);

  useAutoCloseAfterCopy({
    open: isOpen,
    copyTriggered: actions.copyTriggered,
    onClose: () => handleOpenChange(false),
  });

  const handleStopPropagation = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        {children}
        <DropdownMenuContent
          align="end"
          sideOffset={4}
          onClick={handleStopPropagation}
        >
          <ItemMenuItems
            item={item}
            review={review}
            onTogglePin={onTogglePin}
            onToggleRead={onToggleRead}
            onDelete={onDelete}
            {...actions}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <ItemReviewDialog review={review} />
    </>
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
  const review = useItemReview({ item, menuOpen: open });

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
    <>
      <ContextMenuRoot open={open} onOpenChange={setOpen}>
        {children}
        <ContextMenuContent>
          <ItemMenuItems
            item={item}
            review={review}
            onTogglePin={onTogglePin}
            onToggleRead={onToggleRead}
            onDelete={onDelete}
            {...actions}
          />
        </ContextMenuContent>
      </ContextMenuRoot>
      <ItemReviewDialog review={review} />
    </>
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
        className="ml-1 flex size-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover/open-tab:opacity-100 hover:bg-secondary focus-visible:opacity-100"
      >
        {copied ? <IconCheck /> : <IconCopy />}
      </button>
    </DropdownMenuItem>
  );
};
