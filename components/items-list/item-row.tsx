import React from "react";

import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";
import { useSettings } from "@/lib/use-settings";

import { ItemContextMenu, ItemContextMenuTrigger } from "./item-dropdown";
import { resolveRowItem } from "./utils";
import { ItemRowContent } from "./item-row-content";
import { CozyRowContent } from "./cozy-row-content";
import { useIsCursor, useIsOpenItem } from "./cursor-store";
import { useItemActions, useItemRowState } from "./item-row-context";

export const ItemRow = ({ item }: { item: Item }) => {
  const density = useSettings().settings.density;
  const { onSelect, onDelete, onToggleRead, onTogglePin } = useItemActions();
  const { suppressHover, typingTitles } = useItemRowState();

  const isCursor = useIsCursor(item.id);
  const isOpen = useIsOpenItem(item.id);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);

  // Overlay the in-progress typewriter title (post-paste) onto the row for
  // display, without touching the cached item.
  const typingTitle = typingTitles[item.id];
  const rowItem = resolveRowItem(item, typingTitle);
  const isTyping = typingTitle !== undefined;
  const isRead = item.read;

  const handleSelect = React.useCallback(
    () => onSelect(item.id),
    [onSelect, item.id],
  );
  const handleTogglePin = React.useCallback(
    () => onTogglePin(item.id, !item.starred),
    [onTogglePin, item.id, item.starred],
  );
  const handleToggleRead = React.useCallback(
    () => onToggleRead(item.id, !item.read),
    [onToggleRead, item.id, item.read],
  );
  const handleDelete = React.useCallback(
    () => onDelete(item.id),
    [onDelete, item.id],
  );

  return (
    <ItemContextMenu
      item={rowItem}
      onTogglePin={handleTogglePin}
      onToggleRead={handleToggleRead}
      onDelete={handleDelete}
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
            onClick={handleSelect}
          />
        }
      >
        {density === "cozy" ? (
          <CozyRowContent
            item={rowItem}
            isSelected={isOpen}
            isTyping={isTyping}
            menuOpen={menuOpen}
            suppressHover={suppressHover}
            onMenuOpenChange={setMenuOpen}
            onTogglePin={handleTogglePin}
            onToggleRead={handleToggleRead}
            onDelete={handleDelete}
          />
        ) : (
          <ItemRowContent
            item={rowItem}
            flashcardCount={item.flashcardCount}
            isSelected={isOpen}
            isTyping={isTyping}
            menuOpen={menuOpen}
            suppressHover={suppressHover}
            onMenuOpenChange={setMenuOpen}
            onTogglePin={handleTogglePin}
            onToggleRead={handleToggleRead}
            onDelete={handleDelete}
          />
        )}
      </ItemContextMenuTrigger>
    </ItemContextMenu>
  );
};
