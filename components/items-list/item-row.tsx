import React from "react";

import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";
import { useSettings } from "@/lib/use-settings";

import { BulkMenuItems } from "./bulk-menu-items";
import { DragToWindowGhost } from "./drag-to-window-ghost";
import { ItemContextMenu, ItemContextMenuTrigger } from "./item-dropdown";
import { useDragToWindow } from "./use-drag-to-window";
import { resolveRowItem } from "./utils";
import { ItemRowContent } from "./item-row-content";
import { CozyRowContent } from "./cozy-row-content";
import { useIsCursor, useIsOpenItem } from "./cursor-store";
import { getSelectedIds, useIsSelected } from "./selection-store";
import { useItemActions, useItemRowState } from "./item-row-context";

export const ItemRow = ({ item }: { item: Item }) => {
  const density = useSettings().settings.density;
  const { onSelect, onDelete, onToggleRead, onTogglePin } = useItemActions();
  const { suppressHover, typingTitles } = useItemRowState();

  const isCursor = useIsCursor(item.id);
  const isOpen = useIsOpenItem(item.id);
  const isSelected = useIsSelected(item.id);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);
  // Snapshot of the multi-selection taken when the context menu opens: while
  // this row is one of several selected rows, the menu shows bulk actions
  // over exactly these ids. Kept through close so the content doesn't swap
  // mid-exit-animation; null means the normal single-item menu.
  const [bulkMenuIds, setBulkMenuIds] = React.useState<string[] | null>(null);

  // Overlay the in-progress typewriter title (post-paste) onto the row for
  // display, without touching the cached item.
  const typingTitle = typingTitles[item.id];
  const rowItem = resolveRowItem(item, typingTitle);
  const isTyping = typingTitle !== undefined;
  const isRead = item.read;

  // EXPERIMENT: drag a row past the window edge to pop it into its own window.
  const { onPointerDown, drag, wasDragged } = useDragToWindow(item);

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      // A drag-release fires a trailing click — swallow it so tearing off
      // doesn't also select the row.
      if (wasDragged()) return;
      onSelect(item.id, {
        meta: e.metaKey || e.ctrlKey,
        shift: e.shiftKey,
      });
    },
    [onSelect, item.id, wasDragged],
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

  const handleContextMenuOpenChange = React.useCallback(
    (open: boolean) => {
      setContextMenuOpen(open);
      if (open) {
        const selected = getSelectedIds();
        setBulkMenuIds(
          selected.size > 1 && selected.has(item.id) ? [...selected] : null,
        );
      }
    },
    [item.id],
  );

  return (
    <ItemContextMenu
      item={rowItem}
      onTogglePin={handleTogglePin}
      onToggleRead={handleToggleRead}
      onDelete={handleDelete}
      onOpenChange={handleContextMenuOpenChange}
      bulkContent={
        bulkMenuIds ? <BulkMenuItems itemIds={bulkMenuIds} /> : undefined
      }
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
              // Open wins; multi-selected rows share the hover/cursor tint,
              // which also keeps the right-edge occluders in the row content
              // (page background + muted/50 stack) an exact match.
              isOpen && "bg-muted",
              !isOpen && (isSelected || isCursor) && "bg-muted/50",
              !isOpen &&
                !isSelected &&
                !isCursor &&
                !suppressHover &&
                "hover:bg-muted/50",
              !isOpen &&
                !isSelected &&
                !isCursor &&
                (menuOpen || contextMenuOpen) &&
                "bg-muted/50",
              isRead && "opacity-50",
            )}
            data-menu-open={menuOpen || contextMenuOpen || undefined}
            onPointerDown={onPointerDown}
            onClick={handleClick}
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
      <DragToWindowGhost item={rowItem} drag={drag} />
    </ItemContextMenu>
  );
};
