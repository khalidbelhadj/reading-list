import { IconDots } from "@tabler/icons-react";
import type React from "react";

import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ItemDropdown } from "./item-dropdown";

// Blocks shared verbatim between the compact (item-row-content) and cozy
// (cozy-row-content) row layouts. Only the cloned pieces live here — the
// surrounding layouts stay distinct in their own files.

/** The item title with typing placeholder and read strikethrough. */
export const RowTitle = ({
  item,
  isTyping,
  className,
}: {
  item: Item;
  isTyping?: boolean;
  className?: string;
}) => (
  <span
    data-item-title
    className={cn(
      "fade-r min-w-0 font-content text-sm/5",
      !item.title && !isTyping && "text-muted-foreground",
      className,
    )}
  >
    <span className="title-strike" data-read={item.read ? "true" : undefined}>
      {item.title || (isTyping ? " " : "Untitled")}
    </span>
  </span>
);

/**
 * The hover-revealed row dropdown: occluder gradient + ⋯ trigger wrapped in
 * ItemDropdown. `align` positions the trigger for the row's layout —
 * "center" for compact rows, "start" (top-aligned) for cozy rows.
 */
export const RowMenu = ({
  item,
  isOpen,
  menuOpen,
  suppressHover,
  align,
  onMenuOpenChange,
  onTogglePin,
  onToggleRead,
  onToggleHiddenFromReview,
  onDelete,
}: {
  item: Item;
  // Whether this row's item is open in the detail panel — drives the solid
  // bg-muted occluder that matches the open row's background.
  isOpen: boolean;
  menuOpen: boolean;
  suppressHover?: boolean;
  align: "center" | "start";
  onMenuOpenChange: (open: boolean) => void;
  onTogglePin?: () => void;
  onToggleRead?: () => void;
  onToggleHiddenFromReview?: () => void;
  onDelete?: () => void;
}) => (
  <ItemDropdown
    item={item}
    open={menuOpen}
    onOpenChange={onMenuOpenChange}
    onTogglePin={onTogglePin}
    onToggleRead={onToggleRead}
    onToggleHiddenFromReview={onToggleHiddenFromReview}
    onDelete={onDelete}
  >
    <div
      className={cn(
        "pointer-events-none invisible absolute inset-y-0 right-0 flex pl-12 group-data-menu-open:visible",
        align === "center" ? "items-center pr-1" : "items-start pt-2 pr-2",
        !suppressHover && "group-hover:visible",
      )}
    >
      {/* Occluder so the title fades out cleanly behind the menu button.
          Must match the row's background: open rows are a solid
          bg-muted, while hovered rows are the page background lifted by
          a translucent muted/50 — so stack both layers to match. */}
      {isOpen ? (
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-muted to-muted" />
      ) : (
        <>
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-background to-background" />
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-muted/50 to-muted/50" />
        </>
      )}
      <DropdownMenuTrigger
        className={cn(
          "pointer-events-auto relative shrink-0 rounded p-1 text-muted-foreground outline-none hover:text-foreground",
          isOpen && "bg-muted",
        )}
        onClick={stopPropagation}
        onPointerDown={stopPropagation}
      >
        <IconDots className="size-4" />
      </DropdownMenuTrigger>
    </div>
  </ItemDropdown>
);

const stopPropagation = (e: React.SyntheticEvent) => {
  e.stopPropagation();
};
