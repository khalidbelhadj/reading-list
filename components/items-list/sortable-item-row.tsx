import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React from "react";

import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";
import {
  useHoverPreview,
  HoverPreviewContent,
} from "@/components/ui/preview-card";

import {
  ItemContextMenu,
  ItemContextMenuTrigger,
} from "./item-dropdown";
import { type Density } from "./utils";
import { ItemPreview } from "./item-preview";
import { ItemRowContent } from "./item-row-content";
import { CozyRowContent } from "./cozy-row-content";
import { useIsCursor, useIsOpenItem } from "./cursor-store";

const PREVIEW_DELAY = 1000;

export function SortableItemRow({
  item,
  suppressHover,
  suppressTransition,
  isDragDisabled,
  isTyping,
  density = "compact",
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
  density?: Density;
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
            "group relative flex overflow-hidden select-none active:cursor-grabbing outline-none rounded-lg",
            density === "cozy"
              ? "items-stretch gap-3 p-2"
              : "items-center gap-2 p-1",
            isOpen && "bg-secondary",
            // Hover/cursor/menu-open all use a translucent fill (matching cozy
            // mode) rather than bg-muted — in dark mode bg-muted resolves to the
            // same token as bg-secondary, so the compact hover was identical to
            // the active state.
            !isOpen && isCursor && "bg-foreground/5",
            !isOpen && !isCursor && !suppressHover && "hover:bg-foreground/5",
            !isOpen && !isCursor && (menuOpen || contextMenuOpen) && "bg-foreground/5",
            isRead && "opacity-50",
          )}
          data-menu-open={menuOpen || contextMenuOpen || undefined}
          onClick={onSelect}
          onMouseEnter={density === "cozy" ? undefined : preview.onMouseEnter}
          onMouseMove={density === "cozy" ? undefined : preview.onMouseMove}
          onMouseLeave={density === "cozy" ? undefined : preview.onMouseLeave}
          {...attributes}
          {...listeners}
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
    {density !== "cozy" && (
      <HoverPreviewContent open={preview.open} position={preview.position}>
        <ItemPreview item={item} />
      </HoverPreviewContent>
    )}
    </>
  );
}
