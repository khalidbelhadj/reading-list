import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconDots, IconFile } from "@tabler/icons-react";
import Image from "next/image";
import React from "react";

import { cn } from "@/lib/utils";
import { type Item, isReadingListItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { ItemDropdown } from "./item-dropdown";
import { type EditFields, getFaviconSrc } from "./utils";

export function SortableItemRow({
  item,
  flashcardCount,
  isEditing,
  isSelected,
  isMobile,
  suppressHover,
  suppressTransition,
  isDragDisabled,
  onToggleRead,
  onSelect,
  onStartEdit,
  onDelete,
  onOpenMenu,
}: {
  item: Item;
  flashcardCount: number;
  isEditing: boolean;
  isSelected: boolean;
  isMobile: boolean;
  suppressHover: boolean;
  suppressTransition?: boolean;
  isDragDisabled: boolean;
  onToggleRead?: () => void;
  onSelect: () => void;
  onStartEdit: () => void;
  onSave?: (fields: EditFields) => void;
  onDelete?: () => void;
  onCancelEdit?: () => void;
  onOpenMenu?: () => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-item-id={item.id}
      className={cn(
        "group relative flex items-center gap-2 p-1 overflow-hidden select-none active:cursor-grabbing outline-none rounded-lg",
        isSelected && "bg-secondary",
        !isSelected && !suppressHover && "hover:bg-card",
        !isSelected && menuOpen && "bg-card",
        isReadingListItem(item) && item.read && "opacity-50",
      )}
      data-menu-open={menuOpen || undefined}
      onClick={onSelect}
      onDoubleClick={(e) => {
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
          onStartEdit();
        }
      }}
      {...attributes}
      {...listeners}
    >
      <div className="relative size-4 shrink-0">
        {getFaviconSrc(item) ? (
          <Image
            src={getFaviconSrc(item)!}
            alt=""
            width={16}
            height={16}
            className={cn(
              "size-4 rounded-[3px]",
              !isMobile && onToggleRead && "group-hover:invisible",
            )}
            unoptimized
          />
        ) : (
          <IconFile
            className={cn(
              "size-4 text-muted-foreground",
              !isMobile && onToggleRead && "group-hover:invisible",
            )}
          />
        )}
        {!isMobile && onToggleRead && (
          <div className="absolute inset-0 invisible group-hover:visible flex items-center justify-center">
            <Checkbox
              checked={isReadingListItem(item) && item.read}
              onCheckedChange={() => onToggleRead()}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="size-3.5"
            />
          </div>
        )}
      </div>
      {item.url && URL.canParse(item.url) ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          data-item-title
          className={cn(
            "font-content text-sm truncate min-w-0 hover:underline",
            isReadingListItem(item) && item.read && "line-through",
            !item.title && "text-muted-foreground",
          )}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {item.title || "Untitled"}
        </a>
      ) : (
        <span
          data-item-title
          className={cn(
            "font-content text-sm truncate min-w-0",
            isReadingListItem(item) && item.read && "line-through",
            !item.title && "text-muted-foreground",
          )}
        >
          {item.title || "Untitled"}
        </span>
      )}
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
      {isMobile && onOpenMenu && (
        <button
          type="button"
          className="ml-auto shrink-0 text-muted-foreground p-1 -mr-1"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <IconDots className="size-4" />
        </button>
      )}
      {!isMobile && (
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
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <IconDots className="size-4" />
            </DropdownMenuTrigger>
          </div>
        </ItemDropdown>
      )}
    </div>
  );
}
