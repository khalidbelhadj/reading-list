import React from "react";

import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";

import { ItemContextMenu, ItemContextMenuTrigger } from "./item-dropdown";
import { type Density } from "./utils";
import { ItemRowContent } from "./item-row-content";
import { CozyRowContent } from "./cozy-row-content";
import { useIsCursor, useIsOpenItem } from "./cursor-store";

export const ItemRow = ({
  item,
  suppressHover,
  isTyping,
  density = "compact",
  onTogglePin,
  onToggleRead,
  onSelect,
  onDelete,
}: {
  item: Item;
  suppressHover: boolean;
  isTyping?: boolean;
  density?: Density;
  onTogglePin?: () => void;
  onToggleRead?: () => void;
  onSelect: () => void;
  onDelete?: () => void;
}) => {
  const isCursor = useIsCursor(item.id);
  const isOpen = useIsOpenItem(item.id);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);

  const isRead = item.read;

  return (
    <ItemContextMenu
      item={item}
      onTogglePin={onTogglePin}
      onToggleRead={onToggleRead}
      onDelete={onDelete}
      onOpenChange={setContextMenuOpen}
    >
      <ItemContextMenuTrigger
        render={
          <div
            data-item-id={item.id}
            className={cn(
              "group relative flex overflow-hidden rounded-sm outline-none select-none",
              density === "cozy"
                ? "items-stretch gap-3 p-2"
                : "items-center gap-2 p-1",
              isOpen && "bg-muted",
              !isOpen && isCursor && "bg-muted/50",
              !isOpen && !isCursor && !suppressHover && "hover:bg-muted/50",
              !isOpen &&
                !isCursor &&
                (menuOpen || contextMenuOpen) &&
                "bg-muted/50",
              isRead && "opacity-50",
            )}
            data-menu-open={menuOpen || contextMenuOpen || undefined}
            onClick={onSelect}
          />
        }
      >
        {density === "cozy" ? (
          <CozyRowContent
            item={item}
            isSelected={isOpen}
            isTyping={isTyping}
            menuOpen={menuOpen}
            suppressHover={suppressHover}
            onMenuOpenChange={setMenuOpen}
            onTogglePin={onTogglePin}
            onToggleRead={onToggleRead}
            onDelete={onDelete}
          />
        ) : (
          <ItemRowContent
            item={item}
            flashcardCount={item.flashcardCount}
            isSelected={isOpen}
            isTyping={isTyping}
            menuOpen={menuOpen}
            suppressHover={suppressHover}
            onMenuOpenChange={setMenuOpen}
            onTogglePin={onTogglePin}
            onToggleRead={onToggleRead}
            onDelete={onDelete}
          />
        )}
      </ItemContextMenuTrigger>
    </ItemContextMenu>
  );
};
