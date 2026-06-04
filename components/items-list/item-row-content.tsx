import { IconDots, IconFileFilled } from "@tabler/icons-react";
import Image from "next/image";
import React from "react";

import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { ItemDropdown } from "./item-dropdown";
import { getFaviconSrc } from "./utils";

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
  onDelete?: () => void;
}) => {
  const isRead = item.read;

  return (
    <>
      <div className="relative size-4 shrink-0">
        {getFaviconSrc(item) ? (
          <Image
            src={getFaviconSrc(item)!}
            alt=""
            width={16}
            height={16}
            className="size-4 rounded-[3px]"
            unoptimized
          />
        ) : (
          <IconFileFilled className="size-4 text-muted-foreground" />
        )}
      </div>
      <span
        data-item-title
        className={cn(
          "font-content text-sm/5 fade-r min-w-0 flex-1",
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
        onDelete={onDelete}
      >
        <div className={cn(
          "absolute inset-y-0 right-0 flex items-center pl-12 pr-1 pointer-events-none invisible group-data-[menu-open]:visible",
          !suppressHover && "group-hover:visible",
        )}>
          {/* Occluder so the title fades out cleanly behind the menu button.
              Must match the row's background: active rows are a solid
              bg-secondary, while hovered rows are the page background lifted by
              a translucent foreground/5 — so stack both layers to match. */}
          {isSelected ? (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-secondary to-secondary" />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background to-background" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-foreground/5" />
            </>
          )}
          <DropdownMenuTrigger
            className={cn(
              "relative pointer-events-auto shrink-0 rounded p-1 text-muted-foreground hover:text-foreground outline-none",
              isSelected && "bg-secondary",
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
