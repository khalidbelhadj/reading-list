import {
  IconAppWindow,
  IconCards,
  IconCardsFilled,
  IconCircleCheck,
  IconCircleMinus,
  IconCopy,
  IconExternalLink,
  IconPencil,
  IconStar,
  IconStarOff,
  IconTrash,
} from "@tabler/icons-react";
import type React from "react";

import {
  ContextMenu,
  ContextMenuTrigger,
  MenuContent,
  MenuItem,
  MenuSeparator,
} from "@/components/system/menu";
import { Tooltip } from "@/components/system/tooltip";

// Claude's spark, in brand colour (the explicit fill wins over the menu's
// muted icon colour). Inlined here rather than imported from the legacy kit.
const IconClaude = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    fill="#cc785c"
    aria-hidden="true"
    className={className}
  >
    <path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z" />
  </svg>
);

// A menu item that stays visible when unavailable: disabled, with a tooltip
// saying why. When available it renders bare.
const WhyDisabled = ({
  reason,
  children,
}: {
  reason: string | null;
  children: React.ReactElement;
}) => (reason ? <Tooltip content={reason}>{children}</Tooltip> : children);

type ItemMenuProps = {
  item: {
    read: boolean;
    starred: boolean;
    hiddenFromReview: boolean;
    url: string;
    flashcardCount: number;
  };
  onToggleRead: () => void;
  onToggleStar: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
  onOpenLink: () => void;
  onCopyLink: () => void;
  // Offered where inline URL editing is possible (the item view).
  onEditLink?: () => void;
  // When the item is open in a browser tab right now: the browser's display
  // name and a callback that raises that exact tab.
  openInBrowser?: string | null;
  onGoToTab?: () => void;
  // Offered where scoped review can start (the item view); disabled with an
  // explanation when the item has no cards.
  onReviewItem?: () => void;
  // Open Claude with the item preloaded as context.
  onChatWithClaude: () => void;
};

// The menu's items, shared by the right-click menu on rows and the dropdown
// in the item view — one vocabulary of actions everywhere.
export const ItemMenuItems = ({
  item,
  onToggleRead,
  onToggleStar,
  onToggleHidden,
  onDelete,
  onOpenLink,
  onCopyLink,
  onEditLink,
  openInBrowser,
  onGoToTab,
  onReviewItem,
  onChatWithClaude,
}: ItemMenuProps) => (
  <>
    {openInBrowser && onGoToTab && (
      <MenuItem icon={<IconAppWindow />} onClick={onGoToTab}>
        Go to {openInBrowser} tab
      </MenuItem>
    )}
    <WhyDisabled reason={item.url ? null : "This item has no link"}>
      <MenuItem
        icon={<IconExternalLink />}
        disabled={!item.url}
        onClick={onOpenLink}
      >
        Open link
      </MenuItem>
    </WhyDisabled>
    <WhyDisabled reason={item.url ? null : "This item has no link"}>
      <MenuItem icon={<IconCopy />} disabled={!item.url} onClick={onCopyLink}>
        Copy link
      </MenuItem>
    </WhyDisabled>
    {onEditLink && (
      <MenuItem icon={<IconPencil />} onClick={onEditLink}>
        {item.url ? "Edit link" : "Add link"}
      </MenuItem>
    )}
    <MenuSeparator />
    <MenuItem
      icon={item.read ? <IconCircleMinus /> : <IconCircleCheck />}
      onClick={onToggleRead}
    >
      {item.read ? "Mark as unread" : "Mark as read"}
    </MenuItem>
    <MenuItem
      icon={item.starred ? <IconStarOff /> : <IconStar />}
      onClick={onToggleStar}
    >
      {item.starred ? "Unstar" : "Star"}
    </MenuItem>
    {onReviewItem && (
      <WhyDisabled
        reason={item.flashcardCount > 0 ? null : "This item has no cards"}
      >
        <MenuItem
          icon={<IconCards />}
          disabled={item.flashcardCount === 0}
          onClick={onReviewItem}
        >
          Review this item
        </MenuItem>
      </WhyDisabled>
    )}
    <MenuItem
      icon={item.hiddenFromReview ? <IconCardsFilled /> : <IconCards />}
      onClick={onToggleHidden}
    >
      {item.hiddenFromReview ? "Show in review" : "Hide from review"}
    </MenuItem>
    <MenuSeparator />
    <MenuItem icon={<IconClaude />} onClick={onChatWithClaude}>
      Chat with Claude
    </MenuItem>
    <MenuSeparator />
    <MenuItem icon={<IconTrash />} destructive onClick={onDelete}>
      Delete
    </MenuItem>
  </>
);

// The right-click menu for an item row, anywhere a row appears. Presentation
// only: takes the item's state and callbacks; the caller owns the mutations.
// `children` is the row element the menu attaches to. `onOpenChange` lets a
// host react to the menu opening (e.g. the sidebar pausing its hover card).
export const ItemMenu = ({
  children,
  onOpenChange,
  ...props
}: ItemMenuProps & {
  children: React.ReactElement;
  onOpenChange?: (open: boolean) => void;
}) => (
  <ContextMenu onOpenChange={onOpenChange}>
    <ContextMenuTrigger render={children} />
    <MenuContent>
      <ItemMenuItems {...props} />
    </MenuContent>
  </ContextMenu>
);
