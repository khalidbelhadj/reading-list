import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconDots, IconFileFilled } from "@tabler/icons-react";
import Image from "next/image";
import React from "react";

import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import {
  ItemContextMenu,
  ItemContextMenuTrigger,
  ItemDropdown,
} from "./item-dropdown";
import { type EditFields, getFaviconSrc } from "./utils";

export function SortableItemRow({
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
  onSave?: (fields: EditFields) => void;
  onDelete?: () => void;
  onCancelEdit?: () => void;
}) {
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
          {item.title || (isTyping ? " " : "Untitled")}
        </span>
      </span>
      <ItemDropdown
        item={item}
        open={menuOpen}
        onOpenChange={setMenuOpen}
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
    </ItemContextMenuTrigger>
    </ItemContextMenu>
  );
}

function stopPropagation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

