import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconArrowUpRight,
  IconCheck,
  IconGlobe,
  IconX,
} from "@tabler/icons-react";
import React from "react";

import { cn } from "@/lib/utils";
import { type Item, isReadingListItem } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";

import { type EditFields, relativeTime, getFaviconSrc } from "./utils";

function InlineEditForm({
  initialTitle,
  initialUrl,
  initialTags,
  initialNotes,
  faviconSrc,
  updatedAt,
  onSave,
  onCancel,
  onDelete,
}: {
  initialTitle: string;
  initialUrl: string;
  initialTags: string;
  initialNotes: string;
  faviconSrc: string | null;
  updatedAt?: string;
  onSave: (fields: EditFields) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = React.useState(initialTitle);
  const [url, setUrl] = React.useState(initialUrl);
  const [tagsInput, setTagsInput] = React.useState(initialTags);
  const [notes, setNotes] = React.useState(initialNotes);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (saving) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSaving(true);
        onSave({ title, url, tags: tagsInput, notes });
      }
      if (e.key === "Backspace" && (e.metaKey || e.ctrlKey) && onDelete) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setSaving(true);
        onDelete();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [title, url, tagsInput, notes, onSave, onCancel, onDelete, saving]);

  return (
    <div
      className={cn("bg-accent/50 rounded-md px-1 py-1 transition-opacity", saving && "opacity-50 pointer-events-none")}
    >
      <div className="flex items-start gap-2">
        <div className="size-4 mt-[3px] shrink-0 flex items-center justify-center rounded bg-accent">
          {faviconSrc ? (
            <img
              src={faviconSrc}
              alt=""
              width={16}
              height={16}
              className="size-4 rounded-[3px]"
            />
          ) : (
            <IconGlobe className="size-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            data-item-title
            className="text-sm bg-transparent outline-none w-full placeholder:text-muted-foreground"
            style={{ fontFamily: "var(--font-item)" }}
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="text-xs text-muted-foreground/70 bg-transparent outline-none w-full placeholder:text-muted-foreground/40"
          />
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags (comma-separated)"
            className="text-[11px] italic text-muted-foreground/50 bg-transparent outline-none w-full placeholder:text-muted-foreground/30"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes..."
            rows={2}
            className="text-xs text-muted-foreground bg-transparent outline-none resize-none w-full placeholder:text-muted-foreground/40"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 mt-1">
        {updatedAt && (
          <span
            className="text-[10px] text-muted-foreground/40 mr-0.5"
            title={new Date(updatedAt).toLocaleString()}
          >
            {relativeTime(updatedAt)}
          </span>
        )}
        <button
          type="button"
          className="text-muted-foreground/50 hover:text-foreground cursor-pointer"
          onClick={() => onCancel()}
        >
          <IconX className="size-3.5" />
        </button>
        <button
          type="button"
          className="text-muted-foreground/50 hover:text-foreground cursor-pointer"
          onClick={() => {
            setSaving(true);
            onSave({ title, url, tags: tagsInput, notes });
          }}
        >
          <IconCheck className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export { InlineEditForm };

export function SortableItemRow({
  item,
  isEditing,
  isSelected,
  isBulkMode,
  selectedTop,
  selectedBottom,
  suppressHover,
  isDragDisabled,
  onToggleRead,
  onSelect,
  onRightClick,
  onStartEdit,
  onSave,
  onCancelEdit,
  onDelete,
}: {
  item: Item;
  isEditing: boolean;
  isSelected: boolean;
  isBulkMode: boolean;
  selectedTop: boolean;
  selectedBottom: boolean;
  suppressHover: boolean;
  isDragDisabled: boolean;
  onToggleRead?: () => void;
  onSelect: (e: React.MouseEvent) => void;
  onRightClick: () => void;
  onStartEdit: () => void;
  onSave: (fields: EditFields) => void;
  onDelete: () => void;
  onCancelEdit: () => void;
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

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style}>
        <InlineEditForm
          initialTitle={item.title}
          initialUrl={item.url}
          initialTags={item.tags.map((t) => t.name).join(", ")}
          initialNotes={item.notes ?? ""}
          faviconSrc={getFaviconSrc(item)}
          updatedAt={item.updatedAt}
          onSave={onSave}
          onCancel={onCancelEdit}
          onDelete={onDelete}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-item-id={item.id}
      className={cn(
        "group relative flex items-center gap-2 py-1 px-1 overflow-hidden select-none active:cursor-grabbing outline-none",
        isSelected
          ? cn(
              isBulkMode ? "bg-blue-500/10 dark:bg-blue-400/10" : "bg-accent",
              selectedTop && selectedBottom && "rounded-md",
              selectedTop && !selectedBottom && "rounded-t-md",
              !selectedTop && selectedBottom && "rounded-b-md",
            )
          : "rounded-md",
        !isSelected && !suppressHover && "hover:bg-accent/50",
        isReadingListItem(item) && item.read && "opacity-50",
      )}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        onRightClick();
      }}
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
          <img
            src={getFaviconSrc(item)!}
            alt=""
            width={16}
            height={16}
            className={cn(
              "size-4 rounded-[3px]",
              onToggleRead && "group-hover:invisible",
            )}
            loading="lazy"
          />
        ) : (
          <IconGlobe
            className={cn(
              "size-4 text-muted-foreground",
              onToggleRead && "group-hover:invisible",
            )}
          />
        )}
        {onToggleRead && (
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
      <span
        data-item-title
        className={cn(
          "text-sm truncate min-w-0",
          isReadingListItem(item) && item.read && "line-through",
          !item.title && "text-muted-foreground",
        )}
        style={{ fontFamily: "var(--font-item)" }}
      >
        {item.title || "Untitled"}
      </span>
      {item.tags.length > 0 && (
        <span className="text-[11px] italic text-muted-foreground/50 max-w-1/2 truncate hidden sm:inline ml-auto">
          {item.tags.map((t) => t.name).join(", ")}
        </span>
      )}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 flex items-center",
          suppressHover ? "invisible" : "invisible group-hover:visible",
        )}
      >
        <div className="w-8 h-full" style={{ background: `linear-gradient(to right, transparent, ${
          isSelected && isBulkMode
            ? "color-mix(in oklch, oklch(0.55 0.2 260) 10%, var(--color-background))"
            : isSelected
            ? "color-mix(in oklch, var(--color-accent) 50%, var(--color-background))"
            : "var(--color-background)"
        })` }} />
        <div className="h-full flex items-center pr-1" style={{ backgroundColor:
          isSelected && isBulkMode
            ? "color-mix(in oklch, oklch(0.55 0.2 260) 10%, var(--color-background))"
            : isSelected
            ? "color-mix(in oklch, var(--color-accent) 50%, var(--color-background))"
            : "var(--color-background)"
        }}>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            window.open(item.url, "_blank");
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <IconArrowUpRight className="size-4" />
        </button>
        </div>
      </div>
    </div>
  );
}
