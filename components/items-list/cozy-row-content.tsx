import { IconDots } from "@tabler/icons-react";
import React from "react";

import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ItemDropdown } from "./item-dropdown";
import { ItemThumbnail } from "./item-thumbnail";

export const CozyRowContent = ({
  item,
  isSelected,
  isTyping,
  menuOpen,
  suppressHover,
  onMenuOpenChange,
  onTogglePin,
  onToggleRead,
  onDelete,
}: {
  item: Item;
  isSelected: boolean;
  isTyping?: boolean;
  menuOpen: boolean;
  suppressHover?: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onTogglePin?: () => void;
  onToggleRead?: () => void;
  onDelete?: () => void;
}) => {
  const isRead = item.read;

  return (
    <>
      <ItemThumbnail
        item={item}
        className="aspect-video w-24 shrink-0 rounded-[3px]"
      />

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span
          data-item-title
          className={cn(
            "fade-r min-w-0 font-content text-sm/5",
            !item.title && !isTyping && "text-muted-foreground",
          )}
        >
          <span
            className="title-strike"
            data-read={isRead ? "true" : undefined}
          >
            {item.title || (isTyping ? " " : "Untitled")}
          </span>
        </span>
        {item.url && (
          <span className="fade-r block min-w-0 text-xs text-muted-foreground/60">
            {item.url}
          </span>
        )}
        {/*
          Tags are intentionally NOT rendered in cozy mode (they are shown in
          compact mode and the detail panel). Considerations:
          - Row height: the thumbnail is a fixed aspect-video (~54px) while the
            content column drives row height. Title + url sits under the
            thumbnail height, so tagless rows settle at one uniform height. A
            tag row pushes the content column past the thumbnail, making tagged
            rows ~10px taller than their neighbours and breaking the list's
            vertical rhythm.
          - Thumbnail stretch: rows use `items-stretch`, so a taller tagged row
            also stretches the thumbnail, distorting its 16:9 aspect ratio.
          Dropping tags here keeps every cozy row the same height and the
          previews undistorted. If tags are wanted back, also reserve constant
          space for them (so heights stay uniform) and switch the row off
          `items-stretch` so the thumbnail keeps its ratio.
        */}
      </div>

      <ItemDropdown
        item={item}
        open={menuOpen}
        onOpenChange={onMenuOpenChange}
        onTogglePin={onTogglePin}
        onToggleRead={onToggleRead}
        onDelete={onDelete}
      >
        <div
          className={cn(
            "pointer-events-none invisible absolute inset-y-0 right-0 flex items-start pt-2 pr-2 pl-12 group-data-menu-open:visible",
            !suppressHover && "group-hover:visible",
          )}
        >
          {/* Occluder so the title/url fade out cleanly behind the menu button.
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
