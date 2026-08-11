// Item "⋯" dropdown and right-click context menu: shared menu items (open/
// copy/review/read-state/delete), the per-item review submenu, and the shared
// shell wiring (open-state mirror + copy auto-close) via useItemMenuShell.
import {
  IconAppWindow,
  IconArrowUpRight,
  IconArticle,
  IconBolt,
  IconBrowser,
  IconCalendarDue,
  IconCards,
  IconCheck,
  IconCircleOff,
  IconCopy,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconLayoutList,
  IconPin,
  IconPinnedOff,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { getItemReviewStatus, type ReviewMode } from "@/app/actions";
import { ElectronOnly } from "@/components/electron-only";
import { IconClaude } from "@/components/ui/claude-icon";
import {
  ContextMenu as ContextMenuRoot,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  isItemWindow,
  openItemInNewWindow,
  openItemInOriginWindow,
} from "@/lib/app-windows";
import { openChatWithClaude } from "@/lib/chat-with-claude";
import { absoluteTimestamp } from "@/lib/format-time";
import { stripBlankLineSentinel } from "@/lib/markdown";
import { focusBrowserTab, useOpenTab } from "@/lib/open-tabs";
import { dispatchReadItem } from "@/lib/panel-events";
import { useIsElectron } from "@/lib/platform";
import { type Item } from "@/lib/types";

import { Button } from "../ui/button";
import { ReviewConfirmPopover } from "./review-confirm-popover";
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
  onToggleHiddenFromReview?: () => void;
  onDelete?: () => void;
};

// Item-scoped review sessions launched from the menu. Counts are fetched
// lazily when the menu opens (per-item due/new counts aren't part of the
// items query) and the confirm popover lives outside the menu popup so it
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
  // The menu item that launched the confirm has unmounted with the menu by the
  // time the popover positions, so anchor to a snapshot of where it was.
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const anchor = React.useMemo(
    () => (anchorRect ? { getBoundingClientRect: () => anchorRect } : null),
    [anchorRect],
  );

  const openConfirm = React.useCallback(
    (mode: ReviewMode, event: React.MouseEvent) => {
      setAnchorRect(event.currentTarget.getBoundingClientRect());
      setPendingMode(mode);
    },
    [],
  );
  const handleDueClick = React.useCallback(
    (event: React.MouseEvent) => openConfirm("due", event),
    [openConfirm],
  );
  const handleNewClick = React.useCallback(
    (event: React.MouseEvent) => openConfirm("new", event),
    [openConfirm],
  );
  const handleCramClick = React.useCallback(
    (event: React.MouseEvent) => openConfirm("cram", event),
    [openConfirm],
  );

  const handleConfirmOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && !isStarting) setPendingMode(null);
    },
    [isStarting],
  );

  const handleConfirm = React.useCallback(() => {
    if (!pendingMode) return;
    startReview(pendingMode, { itemId: item.id });
  }, [pendingMode, startReview, item.id]);

  const wasStartingRef = React.useRef(false);
  React.useEffect(() => {
    if (wasStartingRef.current && !isStarting && pendingMode !== null) {
      setPendingMode(null);
    }
    wasStartingRef.current = isStarting;
  }, [isStarting, pendingMode]);

  const confirmCardCount =
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
    anchor,
    isStarting,
    handleDueClick,
    handleNewClick,
    handleCramClick,
    handleConfirmOpenChange,
    handleConfirm,
    confirmCardCount,
  };
};

type ItemReviewState = ReturnType<typeof useItemReview>;

const ItemReviewConfirm = ({ review }: { review: ItemReviewState }) => (
  <ReviewConfirmPopover
    open={review.pendingMode !== null}
    onOpenChange={review.handleConfirmOpenChange}
    anchor={review.anchor}
    align="start"
    mode={review.pendingMode}
    cardCount={review.confirmCardCount}
    itemCount={1}
    itemScoped
    onConfirm={review.handleConfirm}
    isStarting={review.isStarting}
  />
);

type CopyTarget = "id" | "title" | "notes";

// Internal hook returning the action handlers + visible-state needed to render
// the menu items. Used by both ItemDropdown and ItemContextMenu so the copy
// feedback behaviour stays consistent across both entry points.
const useItemMenuActions = ({ item }: { item: Item }) => {
  const isElectron = useIsElectron();
  const [lastCopied, setLastCopied] = React.useState<CopyTarget | null>(null);
  const [copyTriggered, setCopyTriggered] = React.useState(false);

  const handleCopyId = React.useCallback(() => {
    navigator.clipboard.writeText(item.id);
    setLastCopied("id");
    setTimeout(() => setLastCopied(null), 2000);
    setCopyTriggered(true);
  }, [item.id]);

  const handleCopyTitle = React.useCallback(() => {
    navigator.clipboard.writeText(item.title);
    setLastCopied("title");
    setTimeout(() => setLastCopied(null), 2000);
    setCopyTriggered(true);
  }, [item.title]);

  const handleCopyNotes = React.useCallback(() => {
    if (!item.notes) return;
    navigator.clipboard.writeText(stripBlankLineSentinel(item.notes));
    setLastCopied("notes");
    setTimeout(() => setLastCopied(null), 2000);
    setCopyTriggered(true);
  }, [item.notes]);

  const handleOpenInNewTab = React.useCallback(() => {
    window.open(item.url, "_blank", "noopener,noreferrer");
  }, [item.url]);

  const handleOpenInNewWindow = React.useCallback(() => {
    openItemInNewWindow(item.id);
  }, [item.id]);

  // Only in a dedicated item window: hand the item back to the central window's
  // list + panel (and raise it). Constant for the window's lifetime.
  const [inItemWindow] = React.useState(isItemWindow);
  const handleOpenInList = React.useCallback(() => {
    openItemInOriginWindow(item.id);
  }, [item.id]);

  // Hand the item off to the desktop app via its readinglist:// protocol; the
  // OS launches/focuses the app and DeepLinkItemWatcher selects the item.
  const handleOpenInApp = React.useCallback(() => {
    window.location.assign(`readinglist://item/${encodeURIComponent(item.id)}`);
  }, [item.id]);

  const handleChatWithClaude = React.useCallback(() => {
    openChatWithClaude(item);
  }, [item]);

  // Desktop only: this item is already open in a browser tab, so offer to jump
  // to it rather than opening a second copy. Null whenever the feature is off,
  // on web, or when nothing matches.
  const openTab = useOpenTab(item.url);
  const handleGoToTab = React.useCallback(() => {
    if (openTab) focusBrowserTab(openTab.ref);
  }, [openTab]);

  // "Read in app" opens the reading panel beside the item's content, in
  // whichever layout is hosting us — PanelLayout in the main window,
  // ItemWindow in a dedicated one. Both subscribe.
  const handleReadInApp = React.useCallback(() => {
    dispatchReadItem(item.id);
  }, [item.id]);

  const canOpenUrl = !!item.url && URL.canParse(item.url);
  const hasNotes =
    !!item.notes && stripBlankLineSentinel(item.notes).trim().length > 0;

  return {
    isElectron,
    lastCopied,
    copyTriggered,
    setCopyTriggered,
    handleCopyId,
    handleCopyTitle,
    handleCopyNotes,
    handleOpenInNewTab,
    handleOpenInNewWindow,
    handleOpenInApp,
    handleChatWithClaude,
    handleReadInApp,
    openTab,
    handleGoToTab,
    inItemWindow,
    handleOpenInList,
    canOpenUrl,
    hasNotes,
  };
};

// Everything ItemMenuItems needs, bundled as one object: the caller-provided
// toggle/delete callbacks, the shared menu action handlers, and review state.
type ItemMenuState = ItemMenuActionsProps &
  ReturnType<typeof useItemMenuActions> & { review: ItemReviewState };

// Shared shell wiring for both menu entry points: mirrors the open state
// (some call sites leave the menu uncontrolled, but the review submenu needs
// to know when it opens to lazily fetch counts), resets the copy flag on
// close, and runs the copy auto-close timer.
const useItemMenuShell = ({
  item,
  open,
  onOpenChange,
}: {
  item: Item;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const actions = useItemMenuActions({ item });

  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setInternalOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  React.useEffect(() => {
    if (!isOpen) actions.setCopyTriggered(false);
  }, [isOpen, actions]);

  useAutoCloseAfterCopy({
    open: isOpen,
    copyTriggered: actions.copyTriggered,
    onClose: () => handleOpenChange(false),
  });

  return { actions, isOpen, handleOpenChange };
};

const CopyMenuItem = ({
  showCopied,
  onCopy,
  label,
}: {
  showCopied: boolean;
  onCopy: () => void;
  label: string;
}) => (
  <Tooltip open={showCopied}>
    <TooltipTrigger
      render={
        <DropdownMenuItem closeOnClick={false} onClick={onCopy}>
          <IconCopy />
          {label}
        </DropdownMenuItem>
      }
    />
    <TooltipContent side="right">Copied</TooltipContent>
  </Tooltip>
);

// Renders just the menu items (no Root/Popup/Content wrapper). Both the
// dropdown and context-menu wrappers use the same MenuPrimitive.Item under
// the hood (ContextMenuRoot creates Menu.Root internally), so DropdownMenu*
// items render correctly inside either context.
const ItemMenuItems = ({ actions }: { actions: ItemMenuState }) => {
  const {
    item,
    review,
    isElectron,
    canOpenUrl,
    hasNotes,
    lastCopied,
    handleOpenInNewTab,
    handleOpenInNewWindow,
    handleOpenInApp,
    handleChatWithClaude,
    handleReadInApp,
    openTab,
    handleGoToTab,
    inItemWindow,
    handleOpenInList,
    handleCopyId,
    handleCopyTitle,
    handleCopyNotes,
    onTogglePin,
    onToggleRead,
    onToggleHiddenFromReview,
    onDelete,
  } = actions;
  const isRead = item.read;
  const isHiddenFromReview = item.hiddenFromReview;

  return (
    <>
      {openTab && (
        <DropdownMenuItem onClick={handleGoToTab}>
          <IconBrowser />
          Go to {openTab.browser} tab
        </DropdownMenuItem>
      )}
      {canOpenUrl && (
        <OpenInNewTabItem url={item.url ?? ""} onOpen={handleOpenInNewTab} />
      )}
      {/* The reader is desktop-only (see dispatchReadItem); on the web the
          "Open in desktop app" item below is the way in. */}
      {canOpenUrl && (
        <ElectronOnly>
          <DropdownMenuItem onClick={handleReadInApp}>
            <IconArticle />
            Read in app
          </DropdownMenuItem>
        </ElectronOnly>
      )}
      {inItemWindow ? (
        <DropdownMenuItem onClick={handleOpenInList}>
          <IconLayoutList />
          Open in list
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onClick={handleOpenInNewWindow}>
          <IconArrowUpRight />
          {isElectron ? "Open in new window" : "Open in new tab"}
        </DropdownMenuItem>
      )}
      {!isElectron && (
        <DropdownMenuItem onClick={handleOpenInApp}>
          <IconAppWindow />
          Open in desktop app
        </DropdownMenuItem>
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
          <CopyMenuItem
            showCopied={lastCopied === "title"}
            onCopy={handleCopyTitle}
            label="Copy title"
          />
          <CopyMenuItem
            showCopied={lastCopied === "id"}
            onCopy={handleCopyId}
            label="Copy ID"
          />
          {hasNotes && (
            <CopyMenuItem
              showCopied={lastCopied === "notes"}
              onCopy={handleCopyNotes}
              label="Copy notes as Markdown"
            />
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
      {onToggleHiddenFromReview && (
        <DropdownMenuItem onClick={onToggleHiddenFromReview}>
          {isHiddenFromReview ? <IconCards /> : <IconCircleOff />}
          {isHiddenFromReview ? "Show in review" : "Hide from review"}
        </DropdownMenuItem>
      )}
      {onDelete && (
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <IconTrash />
          Delete
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <ItemTimestamps item={item} />
    </>
  );
};

// Non-interactive footer showing when the item was created and last edited,
// Notion-style, at the very bottom of the menu.
const ItemTimestamps = ({ item }: { item: Item }) => (
  <div className="px-2 py-1 text-xs leading-snug text-muted-foreground select-none">
    <div>
      Created{" "}
      <span className="tabular-nums">{absoluteTimestamp(item.createdAt)}</span>
    </div>
    <div>
      Edited{" "}
      <span className="tabular-nums">{absoluteTimestamp(item.updatedAt)}</span>
    </div>
  </div>
);

export const ItemDropdown = ({
  item,
  open,
  onOpenChange,
  onTogglePin,
  onToggleRead,
  onToggleHiddenFromReview,
  onDelete,
  children,
}: ItemMenuActionsProps & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  const { actions, isOpen, handleOpenChange } = useItemMenuShell({
    item,
    open,
    onOpenChange,
  });
  const review = useItemReview({ item, menuOpen: isOpen });

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
            actions={{
              ...actions,
              item,
              review,
              onTogglePin,
              onToggleRead,
              onToggleHiddenFromReview,
              onDelete,
            }}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <ItemReviewConfirm review={review} />
    </>
  );
};

export const ItemContextMenu = ({
  item,
  onTogglePin,
  onToggleRead,
  onToggleHiddenFromReview,
  onDelete,
  onOpenChange,
  bulkContent,
  children,
}: ItemMenuActionsProps & {
  onOpenChange?: (open: boolean) => void;
  // When set, the menu shows these bulk-selection actions instead of the
  // single-item ones (ItemRow passes them while the row is part of a
  // multi-selection). Also skips the per-item review-count fetch.
  bulkContent?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const { actions, isOpen, handleOpenChange } = useItemMenuShell({
    item,
    onOpenChange,
  });
  const review = useItemReview({ item, menuOpen: isOpen && !bulkContent });

  return (
    <>
      <ContextMenuRoot open={isOpen} onOpenChange={handleOpenChange}>
        {children}
        <ContextMenuContent>
          {bulkContent ?? (
            <ItemMenuItems
              actions={{
                ...actions,
                item,
                review,
                onTogglePin,
                onToggleRead,
                onToggleHiddenFromReview,
                onDelete,
              }}
            />
          )}
        </ContextMenuContent>
      </ContextMenuRoot>
      {!bulkContent && <ItemReviewConfirm review={review} />}
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

  return (
    <DropdownMenuItem onClick={onOpen} className="group/open-tab pr-1">
      <IconExternalLink />
      <span className="flex-1">Open URL</span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="hover:!bg-accent"
        onClick={handleCopyClick}
      >
        {copied ? (
          <IconCheck className="size-3" />
        ) : (
          <IconCopy className="size-3" />
        )}
      </Button>
    </DropdownMenuItem>
  );
};
