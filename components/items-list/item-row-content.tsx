import { IconDots, IconFileFilled } from "@tabler/icons-react";
import Image from "next/image";
import React from "react";

import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { ItemDropdown } from "./item-dropdown";
import { getFaviconSrc } from "./utils";

export const ItemRowContent = ({
  item,
  flashcardCount,
  isSelected,
  isTyping,
  menuOpen,
  onMenuOpenChange,
  onToggleRead,
  onDelete,
}: {
  item: Item;
  flashcardCount: number;
  isSelected: boolean;
  isTyping?: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
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
          "font-content text-sm truncate min-w-0",
          !item.title && !isTyping && "text-muted-foreground",
        )}
      >
        <span className="title-strike" data-read={isRead ? "true" : undefined}>
          {item.title || (isTyping ? " " : "Untitled")}
        </span>
      </span>
      {item.tags.length > 0 || flashcardCount > 0 ? (
        <div className="hidden sm:flex items-center gap-1 ml-auto shrink-0 max-w-1/2 overflow-hidden">
          {item.tags.map((t) => (
            <Badge key={t.id} variant="secondary" className="shrink-0">
              {t.name}
            </Badge>
          ))}
          {flashcardCount > 0 && (
            <Badge variant="secondary">{flashcardCount}</Badge>
          )}
        </div>
      ) : (
        <div className="hidden sm:block w-4 shrink-0" />
      )}
      <ItemDropdown
        item={item}
        open={menuOpen}
        onOpenChange={onMenuOpenChange}
        onToggleRead={onToggleRead}
        onDelete={onDelete}
      >
        <div className="absolute inset-y-0 right-0 flex items-center pl-12 pr-1 pointer-events-none invisible group-hover:visible group-data-[menu-open]:visible">
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-r from-transparent",
              isSelected ? "via-secondary to-secondary" : "via-card to-card",
            )}
          />
          <DropdownMenuTrigger
            className={cn(
              "relative pointer-events-auto shrink-0 rounded p-1 text-muted-foreground hover:text-foreground outline-none",
              isSelected ? "bg-secondary" : "bg-card",
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
