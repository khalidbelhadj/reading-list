import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconDots,
  IconGlobe,
} from "@tabler/icons-react";
import Image from "next/image";
import React from "react";

import { cn } from "@/lib/utils";
import { type Item, isReadingListItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { type EditFields, getFaviconSrc } from "./utils";

export function SortableItemRow({
  item,
  flashcardCount,
  isEditing,
  isSelected,
  isMobile,
  suppressHover,
  isDragDisabled,
  onToggleRead,
  onSelect,
  onStartEdit,
  onOpenMenu,
}: {
  item: Item;
  flashcardCount: number;
  isEditing: boolean;
  isSelected: boolean;
  isMobile: boolean;
  suppressHover: boolean;
  isDragDisabled: boolean;
  onToggleRead?: () => void;
  onSelect: () => void;
  onStartEdit: () => void;
  onSave?: (fields: EditFields) => void;
  onDelete?: () => void;
  onCancelEdit?: () => void;
  onOpenMenu?: () => void;
}) {
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
    transition: transition?.replace(/(\d+)ms/g, () => "100ms"),
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
        "group relative flex items-center gap-2 py-1 px-1 overflow-hidden select-none active:cursor-grabbing outline-none rounded-md",
        isSelected && "bg-accent",
        !isSelected && !suppressHover && "hover:bg-card",
        isReadingListItem(item) && item.read && "opacity-50",
      )}
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
          <IconGlobe
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
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        data-item-title
        className={cn(
          "font-content text-sm truncate min-w-0",
          isReadingListItem(item) && item.read && "line-through",
          !item.title && "text-muted-foreground",
        )}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {item.title || "Untitled"}
      </a>
      {(item.tags.length > 0 || flashcardCount > 0) && (
        <div className="hidden sm:flex items-center gap-1 ml-auto shrink-0 max-w-1/2 overflow-hidden">
          {item.tags.map((t) => (
            <Badge key={t.id} variant="secondary" className="shrink-0">
              {t.name}
            </Badge>
          ))}
          {flashcardCount > 0 && (
            <Badge variant="secondary">
              {flashcardCount}
            </Badge>
          )}
        </div>
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
    </div>
  );
}
