import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React from "react";

import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";

import {
  ItemContextMenu,
  ItemContextMenuTrigger,
} from "./item-dropdown";
import { type EditFields } from "./utils";
import { ItemRowContent } from "./item-row-content";

export const SortableItemRow = ({
  item,
  flashcardCount,
  isEditing,
  isSelected,
  suppressHover,
  suppressTransition,
  isDragDisabled,
  isTyping,
  onToggleRead,
  onSelect,
  onDelete,
}: {
  item: Item;
  flashcardCount: number;
  isEditing: boolean;
  isSelected: boolean;
  suppressHover: boolean;
  suppressTransition?: boolean;
  isDragDisabled: boolean;
  isTyping?: boolean;
  onToggleRead?: () => void;
  onSelect: () => void;
  onDelete?: () => void;
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: isDragDisabled || isEditing });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: suppressTransition
      ? "none"
      : transition?.replace(/(\d+)ms/g, () => "100ms"),
    opacity: isDragging ? 0.5 : undefined,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };

  const isRead = item.read;

  return (
    <ItemContextMenu
      item={item}
      onToggleRead={onToggleRead}
      onDelete={onDelete}
      onOpenChange={setContextMenuOpen}
    >
    <ItemContextMenuTrigger
      render={
        <div
          ref={setNodeRef}
          style={style}
          data-item-id={item.id}
          className={cn(
            "group relative flex items-center gap-2 p-1 overflow-hidden select-none active:cursor-grabbing outline-none rounded-lg",
            isSelected && "bg-secondary",
            !isSelected && !suppressHover && "hover:bg-card",
            !isSelected && (menuOpen || contextMenuOpen) && "bg-card",
            isRead && "opacity-50",
          )}
          data-menu-open={menuOpen || contextMenuOpen || undefined}
          onClick={onSelect}
          {...attributes}
          {...listeners}
        />
      }
    >
      <ItemRowContent
        item={item}
        flashcardCount={flashcardCount}
        isSelected={isSelected}
        isTyping={isTyping}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        onToggleRead={onToggleRead}
        onDelete={onDelete}
      />
    </ItemContextMenuTrigger>
    </ItemContextMenu>
  );
}
