import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconDots, IconFileFilled } from "@tabler/icons-react";
import Image from "next/image";
import React from "react";

import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  useHoverPreview,
  HoverPreviewContent,
} from "@/components/ui/preview-card";

import {
  ItemContextMenu,
  ItemContextMenuTrigger,
  ItemDropdown,
} from "./item-dropdown";
import { getFaviconSrc } from "./utils";
import { ItemPreview } from "./item-preview";
import { useIsCursor, useIsOpenItem } from "./cursor-store";

const PREVIEW_DELAY = 1000;

export function SortableItemRow({
  item,
  suppressHover,
  suppressTransition,
  isDragDisabled,
  isTyping,
  onTogglePin,
  onToggleRead,
  onSelect,
  onDelete,
}: {
  item: Item;
  flashcardCount?: number;
  suppressHover: boolean;
  suppressTransition?: boolean;
  isDragDisabled: boolean;
  isTyping?: boolean;
  onTogglePin?: () => void;
  onToggleRead?: () => void;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  const isCursor = useIsCursor(item.id);
  const isOpen = useIsOpenItem(item.id);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);
  const preview = useHoverPreview(PREVIEW_DELAY);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: isDragDisabled });


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

  React.useEffect(() => {
    if (menuOpen || contextMenuOpen || isDragging) preview.dismiss();
  }, [menuOpen, contextMenuOpen, isDragging, preview]);

  return (
    <>
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
          ref={setNodeRef}
          style={style}
          data-item-id={item.id}
          className={cn(
            "group relative flex items-center gap-2 p-1 overflow-hidden select-none active:cursor-grabbing outline-none rounded-lg",
            isOpen && "bg-secondary",
            !isOpen && isCursor && "bg-muted",
            !isOpen && !isCursor && !suppressHover && "hover:bg-muted",
            !isOpen && !isCursor && (menuOpen || contextMenuOpen) && "bg-muted",
            isRead && "opacity-50",
          )}
          data-menu-open={menuOpen || contextMenuOpen || undefined}
          onClick={onSelect}
          onMouseEnter={preview.onMouseEnter}
          onMouseMove={preview.onMouseMove}
          onMouseLeave={preview.onMouseLeave}
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
          "font-content text-sm fade-r min-w-0 flex-1",
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
        onOpenChange={setMenuOpen}
        onToggleRead={onToggleRead}
        onDelete={onDelete}
      >
        <div className={cn(
          "absolute inset-y-0 right-0 flex items-center pl-12 pr-1 pointer-events-none invisible group-data-[menu-open]:visible",
          !suppressHover && "group-hover:visible",
        )}>
          <div className={cn(
            "absolute inset-0 bg-gradient-to-r from-transparent",
            isOpen ? "via-secondary to-secondary" : "via-muted to-muted",
          )} />
          <DropdownMenuTrigger
            className={cn(
              "relative pointer-events-auto shrink-0 rounded p-1 text-muted-foreground hover:text-foreground outline-none",
              isOpen ? "bg-secondary" : "bg-muted",
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
    <HoverPreviewContent open={preview.open} position={preview.position}>
      <ItemPreview item={item} />
    </HoverPreviewContent>
    </>
  );
}

function stopPropagation(e: React.SyntheticEvent) {
  e.stopPropagation();
}
