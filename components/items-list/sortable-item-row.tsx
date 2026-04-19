import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconDots, IconFileFilled } from "@tabler/icons-react";
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

  const handleCheckedChange = React.useCallback(() => {
    onToggleRead?.();
  }, [onToggleRead]);

  const handleOpenMenu = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenMenu?.();
    },
    [onOpenMenu],
  );

  const isRead = isReadingListItem(item) && item.read;

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
        isRead && "opacity-50",
      )}
      data-menu-open={menuOpen || undefined}
      onClick={onSelect}
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
          <IconFileFilled
            className={cn(
              "size-4 text-muted-foreground",
              !isMobile && onToggleRead && "group-hover:invisible",
            )}
          />
        )}
        {!isMobile && onToggleRead && (
          <div
            className="absolute inset-0 invisible group-hover:visible flex items-center justify-center"
            onClick={stopPropagation}
            onPointerDown={stopPropagation}
          >
            <Checkbox
              checked={isRead}
              onCheckedChange={handleCheckedChange}
              className="size-4 rounded-full"
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
            !item.title && "text-muted-foreground",
          )}
          onClick={stopPropagation}
          onPointerDown={stopPropagation}
        >
          <span className="title-strike" data-read={isRead ? "true" : undefined}>
            {item.title || "Untitled"}
          </span>
        </a>
      ) : (
        <span
          data-item-title
          className={cn(
            "font-content text-sm truncate min-w-0",
            !item.title && "text-muted-foreground",
          )}
        >
          <span className="title-strike" data-read={isRead ? "true" : undefined}>
            {item.title || "Untitled"}
          </span>
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
          onClick={handleOpenMenu}
          onPointerDown={stopPropagation}
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
              onClick={stopPropagation}
              onPointerDown={stopPropagation}
            >
              <IconDots className="size-4" />
            </DropdownMenuTrigger>
          </div>
        </ItemDropdown>
      )}
    </div>
  );
}

function stopPropagation(e: React.SyntheticEvent) {
  e.stopPropagation();
}
