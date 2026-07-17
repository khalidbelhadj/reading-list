import { IconDots } from "@tabler/icons-react";
import React from "react";

import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ItemDropdown } from "./item-dropdown";
import { Favicon } from "./favicon";

export const ItemRowContent = ({
  item,
  flashcardCount: _flashcardCount,
  isSelected,
  isTyping,
  menuOpen,
  suppressHover,
  onMenuOpenChange,
  onTogglePin,
  onToggleRead,
  onToggleHiddenFromReview,
  onDelete,
}: {
  item: Item;
  flashcardCount: number;
  isSelected: boolean;
  isTyping?: boolean;
  menuOpen: boolean;
  suppressHover?: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onTogglePin?: () => void;
  onToggleRead?: () => void;
  onToggleHiddenFromReview?: () => void;
  onDelete?: () => void;
}) => {
  const isRead = item.read;

  return (
    <>
      <div className="relative size-4 shrink-0">
        <Favicon item={item} className="size-4" />
      </div>
      <span
        data-item-title
        className={cn(
          "fade-r min-w-0 flex-1 font-content text-sm/5",
          !item.title && !isTyping && "text-muted-foreground",
        )}
      >
        <span className="title-strike" data-read={isRead ? "true" : undefined}>
          {item.title || (isTyping ? " " : "Untitled")}
        </span>
      </span>
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
            "pointer-events-none invisible absolute inset-y-0 right-0 flex items-center pr-1 pl-12 group-data-menu-open:visible",
            !suppressHover && "group-hover:visible",
          )}
        >
          {/* Occluder so the title fades out cleanly behind the menu button.
              Must match the row's background: active rows are a solid
              bg-muted, while hovered rows are the page background lifted by
              a translucent muted/50 — so stack both layers to match. */}
          {isSelected ? (
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
              isSelected && "bg-muted",
            )}
            onClick={stopPropagation}
            onPointerDown={stopPropagation}
          >
            <IconDots className="size-4" />
          </DropdownMenuTrigger>
        </div>
      </ItemDropdown>
    </>
  );
};

const stopPropagation = (e: React.SyntheticEvent) => {
  e.stopPropagation();
};
