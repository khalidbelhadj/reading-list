"use client";

import { Button } from "@/components/ui/button";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconArrowUpRight,
  IconArrowsExchange,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconGlobe,
  IconPlus,
  IconSearch,
  IconTag,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import React from "react";

import {
  bulkDeleteItems,
  bulkMarkRead,
  bulkMoveItems,
  bulkTag,
  createItem,
  deleteItem,
  fetchPageTitle,
  importBookmarks,
  reorderItem,
  toggleRead,
  updateItem,
} from "@/app/actions";
import { logout } from "@/app/logout/actions";
import { cn } from "@/lib/utils";
import { type Item, type DbTag, isReadingListItem } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";

type EditFields = {
  title: string;
  url: string;
  tags: string;
  notes: string;
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

async function fetchItems(): Promise<Item[]> {
  const res = await fetch("/api/items");
  return res.json();
}

function getFaviconSrc(item: Pick<Item, "faviconUrl" | "url">): string | null {
  if (item.faviconUrl) return item.faviconUrl;
  try {
    const domain = new URL(item.url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}

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

function SortableItemRow({
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
        <div className="w-8 h-full" style={{ background: "linear-gradient(to right, transparent, color-mix(in oklch, var(--color-accent) 50%, var(--color-background)))" }} />
        <div className="h-full flex items-center pr-1" style={{ backgroundColor: "color-mix(in oklch, var(--color-accent) 50%, var(--color-background))" }}>
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

export function ItemsList() {
  const queryClient = useQueryClient();
  const { data: items, isFetching, error, isPending } = useQuery({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState(() => {
    return searchParams.get("tab") === "bookmarks" ? "bookmarks" : "reading-list";
  });
  const setActiveTabAndUrl = React.useCallback((tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === "reading-list") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [activeTags, setActiveTags] = React.useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem("activeTags") ?? "[]")); } catch { return new Set(); }
  });
  const [tagsOpen, setTagsOpen] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("tagsOpen") === "true";
  });
  const [showRead, setShowRead] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("showRead") === "true";
  });
  React.useEffect(() => { localStorage.setItem("activeTags", JSON.stringify([...activeTags])); }, [activeTags]);
  React.useEffect(() => { localStorage.setItem("tagsOpen", String(tagsOpen)); }, [tagsOpen]);
  React.useEffect(() => { localStorage.setItem("showRead", String(showRead)); }, [showRead]);
  const [suppressHover, setSuppressHover] = React.useState(false);
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);
  const [tagDialogInput, setTagDialogInput] = React.useState("");
  const [pendingActions, setPendingActions] = React.useState(0);
  const [bulkMode, setBulkMode] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 0); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const lastClickedRef = React.useRef<string | null>(null);
  const cursorRef = React.useRef<string | null>(null);
  const anchorRef = React.useRef<string | null>(null);
  const pendingGRef = React.useRef<number>(0);
  const pendingDRef = React.useRef<number>(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Filter by tab type
  const tabType = activeTab === "bookmarks" ? "bookmark" : "reading-list";

  // Cmd+V to quick-add a URL
  React.useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;
      try {
        const url = new URL(text);
        if (url.protocol === "http:" || url.protocol === "https:") {
          e.preventDefault();
          const domain = url.hostname.replace(/^www\./, "");
          void createItem(domain, text, [], undefined, tabType).then(
            async () => {
              await queryClient.invalidateQueries({ queryKey: ["items"] });
              const title = await fetchPageTitle(text);
              if (title) {
                const freshItems = queryClient.getQueryData<Item[]>(["items"]);
                const created = freshItems?.find(
                  (i) => i.url === text && i.title === domain,
                );
                if (created) {
                  await updateItem(created.id, { title });
                  queryClient.invalidateQueries({ queryKey: ["items"] });
                }
              }
            },
          );
        }
      } catch {
        // not a valid URL, ignore
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [tabType, queryClient]);

  // Global keyboard shortcuts: /, r, b, Escape
  React.useEffect(() => {
    function handleSlash(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      // Escape priority chain: editing → search → selection
      if (e.key === "Escape") {
        if (editingId) {
          setEditingId(null);
        } else if (searchOpen) {
          setSearch("");
          setSearchOpen(false);
        } else {
          setSelectedIds(new Set());
          setBulkMode(false);
        }
        return;
      }
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
      if (e.key === "1" && !e.metaKey && !e.ctrlKey) {
        setActiveTabAndUrl("reading-list");
      }
      if (e.key === "2" && !e.metaKey && !e.ctrlKey) {
        setActiveTabAndUrl("bookmarks");
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setHelpOpen(true);
      }
    }
    document.addEventListener("keydown", handleSlash);
    return () => document.removeEventListener("keydown", handleSlash);
  }, [editingId, searchOpen]);

  const tabItems = React.useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.type === tabType)
        .sort((a, b) => a.position - b.position),
    [items, tabType],
  );

  // Collect all unique tags within the active tab
  const allTags = React.useMemo(() => {
    const tagMap = new Map<string, DbTag>();
    for (const item of tabItems) {
      for (const tag of item.tags) {
        tagMap.set(tag.name, tag);
      }
    }
    return Array.from(tagMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [tabItems]);

  // Filter items by search, tags, and read status
  const filteredItems = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    return tabItems.filter((item) => {
      if (isReadingListItem(item) && !showRead && item.read) {
        return false;
      }
      if (
        q &&
        !item.title.toLowerCase().includes(q) &&
        !item.url.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (
        activeTags.size > 0 &&
        !item.tags.some((t) => activeTags.has(t.name))
      ) {
        return false;
      }
      return true;
    });
  }, [tabItems, tabType, showRead, search, activeTags]);

  // Auto-select first result when searching and nothing is selected
  React.useEffect(() => {
    if (search.trim() && filteredItems.length > 0) {
      const anyVisible = Array.from(selectedIds).some((id) =>
        filteredItems.some((i) => i.id === id),
      );
      if (!anyVisible) {
        setSelectedIds(new Set([filteredItems[0].id]));
        cursorRef.current = filteredItems[0].id;
      }
    }
  }, [search, filteredItems, selectedIds]);

  const toggleTag = React.useCallback((tagName: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) {
        next.delete(tagName);
      } else {
        next.add(tagName);
      }
      return next;
    });
  }, []);

  // DnD setup
  const isDragDisabled =
    search.trim().length > 0 || activeTags.size > 0 || editingId !== null || (bulkMode && selectedIds.size >= 1);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const reorderMutation = useMutation({
    mutationFn: async ({
      itemId,
      type,
      newPosition,
    }: {
      itemId: string;
      type: string;
      newPosition: number;
    }) => {
      await reorderItem(itemId, type, newPosition);
    },
    onMutate: async ({ itemId, newPosition }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previousItems = queryClient.getQueryData<Item[]>(["items"]);

      queryClient.setQueryData<Item[]>(["items"], (old) => {
        if (!old) return old;
        const allItems = old.map((i) => ({ ...i }));
        const item = allItems.find((i) => i.id === itemId);
        if (!item) return allItems;

        const typeItems = allItems
          .filter((i) => i.type === item.type)
          .sort((a, b) => a.position - b.position);

        const currentIndex = typeItems.findIndex((i) => i.id === itemId);
        const [moved] = typeItems.splice(currentIndex, 1);
        typeItems.splice(newPosition, 0, moved);
        typeItems.forEach((ti, idx) => {
          ti.position = idx;
        });

        return allItems;
      });

      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["items"], context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const toggleReadMutation = useMutation({
    mutationFn: async ({ itemId, read }: { itemId: string; read: boolean }) => {
      await toggleRead(itemId, read);
    },
    onMutate: async ({ itemId, read }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previousItems = queryClient.getQueryData<Item[]>(["items"]);

      queryClient.setQueryData<Item[]>(["items"], (old) => {
        if (!old) return old;
        return old.map((i) => (i.id === itemId ? { ...i, read } : i));
      });

      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["items"], context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sortedTypeItems = [...tabItems];
    const overIndex = sortedTypeItems.findIndex((i) => i.id === over.id);
    if (overIndex === -1) return;

    reorderMutation.mutate({
      itemId: active.id as string,
      type: tabType,
      newPosition: overIndex,
    });
  }

  const handleDeleteSingle = React.useCallback(
    async (itemId: string) => {
      const idx = filteredItems.findIndex((i) => i.id === itemId);
      const nextItem = filteredItems[idx + 1] ?? filteredItems[idx - 1];
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        old ? old.filter((i) => i.id !== itemId) : old,
      );
      setEditingId(null);
      if (nextItem) {
        setSelectedIds(new Set([nextItem.id]));
        cursorRef.current = nextItem.id;
        anchorRef.current = nextItem.id;
      } else {
        setSelectedIds(new Set());
        cursorRef.current = null;
      }
      setPendingActions((n) => n + 1);
      deleteItem(itemId).then(() => queryClient.invalidateQueries({ queryKey: ["items"] })).finally(() => setPendingActions((n) => n - 1));
    },
    [queryClient, filteredItems],
  );

  // Bulk action handlers
  const handleBulkDelete = React.useCallback(async () => {
    const ids = Array.from(selectedIds);
    // Find the next item after the last selected one
    const lastIdx = Math.max(...ids.map((id) => filteredItems.findIndex((i) => i.id === id)));
    const remaining = filteredItems.filter((i) => !selectedIds.has(i.id));
    const nextItem = remaining.find((_, idx) => {
      const origIdx = filteredItems.findIndex((i) => i.id === remaining[idx].id);
      return origIdx > lastIdx;
    }) ?? remaining[remaining.length - 1];
    queryClient.setQueryData<Item[]>(["items"], (old) =>
      old ? old.filter((i) => !selectedIds.has(i.id)) : old,
    );
    if (nextItem) {
      setSelectedIds(new Set([nextItem.id]));
      cursorRef.current = nextItem.id;
      anchorRef.current = nextItem.id;
    } else {
      setSelectedIds(new Set());
      cursorRef.current = null;
    }
    setPendingActions((n) => n + 1);
    bulkDeleteItems(ids).then(() => queryClient.invalidateQueries({ queryKey: ["items"] })).finally(() => setPendingActions((n) => n - 1));
  }, [selectedIds, queryClient, filteredItems]);

  const handleBulkMarkRead = React.useCallback(async (read: boolean) => {
    const ids = Array.from(selectedIds);
    queryClient.setQueryData<Item[]>(["items"], (old) =>
      old ? old.map((i) =>
        selectedIds.has(i.id) && isReadingListItem(i) ? { ...i, read } : i
      ) : old,
    );
    if (read && !showRead) {
      setSelectedIds(new Set());
      cursorRef.current = null;
    }
    setPendingActions((n) => n + 1);
    bulkMarkRead(ids, read).then(() => queryClient.invalidateQueries({ queryKey: ["items"] })).finally(() => setPendingActions((n) => n - 1));
  }, [selectedIds, showRead, queryClient]);

  const handleBulkMove = React.useCallback(async () => {
    const ids = Array.from(selectedIds);
    const targetType = tabType === "reading-list" ? "bookmark" : "reading-list";
    queryClient.setQueryData<Item[]>(["items"], (old) =>
      old ? old.filter((i) => !selectedIds.has(i.id)) : old,
    );
    setSelectedIds(new Set());
    cursorRef.current = null;
    setPendingActions((n) => n + 1);
    bulkMoveItems(ids, targetType).then(() => queryClient.invalidateQueries({ queryKey: ["items"] })).finally(() => setPendingActions((n) => n - 1));
  }, [selectedIds, tabType, queryClient]);


  // Cmd+Backspace to delete selected items
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === "Backspace" && (e.metaKey || e.ctrlKey) && selectedIds.size > 0 && !editingId) {
        e.preventDefault();
        void handleBulkDelete();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, editingId, handleBulkDelete]);

  // Vim-style navigation, visual mode, Enter to edit, Space to toggle read
  React.useEffect(() => {
    function scrollWithMargin(id: string) {
      const el = document.querySelector(`[data-item-id="${id}"]`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const rowHeight = rect.height;
      const margin = rowHeight * 3;
      const viewTop = 0;
      const viewBottom = window.innerHeight;
      if (rect.top - margin < viewTop) {
        window.scrollBy({ top: rect.top - margin - viewTop });
      } else if (rect.bottom + margin > viewBottom) {
        window.scrollBy({ top: rect.bottom + margin - viewBottom });
      }
    }

    function moveCursor(nextId: string) {
      cursorRef.current = nextId;
      anchorRef.current = nextId;
      setSelectedIds(new Set([nextId]));
      setBulkMode(false);
      setSuppressHover(true);
      scrollWithMargin(nextId);
    }

    function moveCursorVisual(nextId: string) {
      cursorRef.current = nextId;
      const ids = filteredItems.map((i) => i.id);
      const anchor = anchorRef.current && ids.includes(anchorRef.current) ? anchorRef.current : nextId;
      const anchorIdx = ids.indexOf(anchor);
      const cursorIdx = ids.indexOf(nextId);
      const [start, end] = anchorIdx < cursorIdx ? [anchorIdx, cursorIdx] : [cursorIdx, anchorIdx];
      setSelectedIds(new Set(ids.slice(start, end + 1)));
      setSuppressHover(true);
      scrollWithMargin(nextId);
    }

    function handleNav(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (editingId) return;

      const ids = filteredItems.map((i) => i.id);
      const currentCursor = cursorRef.current;
      const cursorIdx = currentCursor ? ids.indexOf(currentCursor) : -1;

      // j / k / Ctrl+N / Ctrl+P — navigation; hold Shift to extend selection
      const isDown = (e.key === "j" && !e.metaKey && !e.ctrlKey && !e.shiftKey)
        || (e.key === "n" && e.ctrlKey && !e.metaKey && !e.shiftKey);
      const isUp = (e.key === "k" && !e.metaKey && !e.ctrlKey && !e.shiftKey)
        || (e.key === "p" && e.ctrlKey && !e.metaKey && !e.shiftKey);
      const isShiftDown = (e.key === "J" && e.shiftKey && !e.metaKey && !e.ctrlKey)
        || (e.key === "N" && e.ctrlKey && e.shiftKey && !e.metaKey);
      const isShiftUp = (e.key === "K" && e.shiftKey && !e.metaKey && !e.ctrlKey)
        || (e.key === "P" && e.ctrlKey && e.shiftKey && !e.metaKey);
      if (isDown || isUp || isShiftDown || isShiftUp) {
        e.preventDefault();
        if (ids.length === 0) return;
        const goingDown = isDown || isShiftDown;
        const extending = isShiftDown || isShiftUp;
        let nextId: string;
        if (cursorIdx === -1) {
          nextId = goingDown ? ids[0] : ids[ids.length - 1];
        } else {
          nextId = goingDown
            ? ids[Math.min(cursorIdx + 1, ids.length - 1)]
            : ids[Math.max(cursorIdx - 1, 0)];
        }
        if (bulkMode || extending) {
          if (!bulkMode) {
            setBulkMode(true);
            anchorRef.current = currentCursor ?? nextId;
          }
          moveCursorVisual(nextId);
        } else {
          moveCursor(nextId);
        }
        return;
      }

      // G (Shift+g) — jump to last item
      if (e.key === "G" && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        pendingGRef.current = 0;
        if (ids.length === 0) return;
        if (bulkMode) {
          moveCursorVisual(ids[ids.length - 1]);
        } else {
          moveCursor(ids[ids.length - 1]);
        }
        return;
      }

      // g — first press sets pending, second press (gg) jumps to first item
      if (e.key === "g" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        const now = Date.now();
        if (now - pendingGRef.current < 300) {
          e.preventDefault();
          pendingGRef.current = 0;
          if (ids.length === 0) return;
          if (bulkMode) {
            moveCursorVisual(ids[0]);
          } else {
            moveCursor(ids[0]);
          }
        } else {
          pendingGRef.current = now;
        }
        return;
      }

      // Ctrl+D / Ctrl+U — half-page jump (~10 items)
      if ((e.key === "d" || e.key === "u") && e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (ids.length === 0) return;
        const jump = 10;
        let nextId: string;
        if (cursorIdx === -1) {
          nextId = e.key === "d" ? ids[Math.min(jump - 1, ids.length - 1)] : ids[0];
        } else {
          nextId = e.key === "d"
            ? ids[Math.min(cursorIdx + jump, ids.length - 1)]
            : ids[Math.max(cursorIdx - jump, 0)];
        }
        if (bulkMode) {
          moveCursorVisual(nextId);
        } else {
          moveCursor(nextId);
        }
        return;
      }

      // dd — delete selected items
      if (e.key === "d" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const now = Date.now();
        if (now - pendingDRef.current < 300) {
          e.preventDefault();
          pendingDRef.current = 0;
          if (selectedIds.size > 0) {
            if (bulkMode && selectedIds.size > 1) {
              void handleBulkDelete();
            } else {
              const id = cursorRef.current && selectedIds.has(cursorRef.current)
                ? cursorRef.current
                : Array.from(selectedIds)[0];
              void handleDeleteSingle(id);
            }
          }
        } else {
          pendingDRef.current = now;
        }
        return;
      }

      // v / V — toggle visual (bulk) mode
      if (e.key === "v" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (bulkMode) {
          setBulkMode(false);
          setSelectedIds(new Set());
        } else {
          setBulkMode(true);
          const target = currentCursor && ids.includes(currentCursor) ? currentCursor : ids[0];
          if (target) {
            cursorRef.current = target;
            anchorRef.current = target;
            setSelectedIds(new Set([target]));
          }
        }
        return;
      }

      // o — open selected in new tab
      if (e.key === "o" && !e.metaKey && !e.ctrlKey && !e.shiftKey && selectedIds.size >= 1) {
        e.preventDefault();
        for (const id of selectedIds) {
          const item = filteredItems.find((i) => i.id === id);
          if (item) window.open(item.url, "_blank");
        }
        return;
      }

      // x — toggle read on selected
      if (e.key === "x" && !e.metaKey && !e.ctrlKey && !e.shiftKey && selectedIds.size > 0) {
        e.preventDefault();
        const selectedItems = filteredItems
          .filter((i) => selectedIds.has(i.id))
          .filter(isReadingListItem);
        if (selectedItems.length === 0) return;
        const allRead = selectedItems.every((i) => i.read);
        if (selectedItems.length === 1) {
          toggleReadMutation.mutate({ itemId: selectedItems[0].id, read: !selectedItems[0].read });
        } else {
          void handleBulkMarkRead(!allRead);
        }
        return;
      }

      // Cmd+Enter to open in new tab
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && selectedIds.size >= 1) {
        e.preventDefault();
        for (const id of selectedIds) {
          const item = filteredItems.find((i) => i.id === id);
          if (item) window.open(item.url, "_blank");
        }
        return;
      }

      // Enter to edit (only if exactly one item selected)
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && selectedIds.size === 1) {
        e.preventDefault();
        const [id] = selectedIds;
        setEditingId(id);
      }

      // Space to toggle read on all selected (reading-list only)
      if (e.key === " " && selectedIds.size > 0) {
        e.preventDefault();
        const selectedItems = filteredItems
          .filter((i) => selectedIds.has(i.id))
          .filter(isReadingListItem);
        if (selectedItems.length === 0) return;
        const allRead = selectedItems.every((i) => i.read);
        if (selectedItems.length === 1) {
          toggleReadMutation.mutate({ itemId: selectedItems[0].id, read: !selectedItems[0].read });
        } else {
          void handleBulkMarkRead(!allRead);
        }
      }
    }
    document.addEventListener("keydown", handleNav);
    return () => document.removeEventListener("keydown", handleNav);
  }, [selectedIds, editingId, filteredItems, bulkMode, handleBulkMarkRead]);

  const handleSave = React.useCallback(
    async (itemId: string, fields: EditFields) => {
      const tagNames = fields.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      if (itemId === "new") {
        if (!fields.title.trim() && !fields.url.trim()) {
          setEditingId(null);
          return;
        }
        await createItem(
          fields.title.trim() || fields.url.trim(),
          fields.url.trim(),
          tagNames,
          undefined,
          tabType,
          fields.notes.trim() || undefined,
        );
      } else {
        await updateItem(itemId, {
          title: fields.title,
          url: fields.url,
          notes: fields.notes,
          tagNames,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["items"] });
      setEditingId(null);
    },
    [tabType, queryClient],
  );

  return (
    <div className="mx-auto max-w-150 px-5 pb-5 flex flex-col gap-3">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 relative flex flex-col gap-3 pt-5 bg-background">
      {/* Toolbar */}
      <div className="flex items-center relative">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTabAndUrl}
          variant="text"
          tabs={[
            { label: "Reading List", value: "reading-list" },
            { label: "Bookmarks", value: "bookmarks" },
          ]}
        />
        {(isFetching || pendingActions > 0) && <Spinner className="size-3 text-muted-foreground/50 ml-2" />}
        <div className="flex-1" />

        {bulkMode && selectedIds.size >= 1 ? (
          <>
            <span className="absolute left-1/2 -translate-x-1/2 text-xs text-muted-foreground">{selectedIds.size} selected</span>
            {tabType === "reading-list" && (
              <>
                <Button variant="ghost" size="icon" className="text-muted-foreground" title="Mark read" onClick={() => void handleBulkMarkRead(true)}>
                  <IconEye />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground" title="Mark unread" onClick={() => void handleBulkMarkRead(false)}>
                  <IconEyeOff />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="text-muted-foreground" title={`Move to ${tabType === "reading-list" ? "Bookmarks" : "Reading List"}`} onClick={() => void handleBulkMove()}>
              <IconArrowsExchange />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground" title="Tag" onClick={() => { setTagDialogInput(""); setTagDialogOpen(true); }}>
              <IconTag />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground" title="Delete" onClick={() => void handleBulkDelete()}>
              <IconTrash />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground" title="Clear selection" onClick={() => { setSelectedIds(new Set()); setBulkMode(false); }}>
              <IconX />
            </Button>
          </>
        ) : (
          <>
            {/* Search toggle */}
            <div
              className={cn(
                "flex items-center h-7 overflow-hidden rounded-md border transition-all duration-200 ease-out",
                searchOpen
                  ? "w-52 border-input bg-input/20"
                  : "w-7 border-transparent",
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground"
                onClick={() => {
                  setSearchOpen(true);
                  requestAnimationFrame(() => searchInputRef.current?.focus());
                }}
              >
                <IconSearch />
              </Button>
              <input
                ref={searchInputRef}
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearch("");
                    setSearchOpen(false);
                    searchInputRef.current?.blur();
                  }
                  if (e.key === "Enter") {
                    searchInputRef.current?.blur();
                  }
                }}
                className="flex-1 min-w-0 h-7 bg-transparent text-xs outline-none"
                tabIndex={searchOpen ? 0 : -1}
              />
            </div>

            {/* Tags toggle */}
            {allTags.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                aria-expanded={tagsOpen || activeTags.size > 0}
                className={
                  tagsOpen || activeTags.size > 0
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
                onClick={() => setTagsOpen((v) => !v)}
              >
                <IconTag />
              </Button>
            )}

            {/* Show read toggle */}
            {tabType === "reading-list" && (
              <Button
                variant="ghost"
                size="icon"
                aria-expanded={showRead}
                className={
                  showRead ? "text-foreground" : "text-muted-foreground"
                }
                onClick={() => setShowRead((v) => !v)}
                title={showRead ? "Hide read items" : "Show read items"}
              >
                {showRead ? <IconEye /> : <IconEyeOff />}
              </Button>
            )}

            {/* Add */}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={() => setEditingId("new")}
            >
              <IconPlus />
            </Button>

          </>
        )}
      </div>

      {/* Tag filters */}
      {tagsOpen && allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags.map((tag) => {
            const isActive = activeTags.has(tag.name);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.name)}
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                }`}
              >
                {tag.name}
              </button>
            );
          })}
          {activeTags.size > 0 && (
            <button
              type="button"
              onClick={() => setActiveTags(new Set())}
              className="px-1.5 py-0.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              clear
            </button>
          )}
        </div>
      )}

      {/* Fade gradient — only when scrolled */}
      {scrolled && <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-b from-background to-transparent translate-y-full pointer-events-none" />}
      </div>

      {/* New item inline form */}
      {editingId === "new" && (
        <InlineEditForm
          initialTitle=""
          initialUrl=""
          initialTags=""
          initialNotes=""
          faviconSrc={null}
          onSave={(fields) => void handleSave("new", fields)}
          onCancel={() => setEditingId(null)}
        />
      )}

      {/* Items list */}
      {isPending ? (
        <div className="px-1 py-6 text-center text-muted-foreground text-xs">Loading...</div>
      ) : error ? (
        (console.error("Failed to fetch items:", error),
        <div className="px-1 py-6 text-center text-destructive text-xs">An error has occurred</div>)
      ) : (
      <DndContext
        id="items-list-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filteredItems.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div onMouseMove={suppressHover ? () => setSuppressHover(false) : undefined}>
            {filteredItems.length === 0 && editingId !== "new" && (
              <div className="px-1 py-6 text-center text-muted-foreground text-xs">
                {tabItems.length === 0
                  ? "Nothing here yet"
                  : "No items match your filters"}
              </div>
            )}
            {filteredItems.map((item, idx) => {
              const isSelected = selectedIds.has(item.id);
              const prevSelected = idx > 0 && selectedIds.has(filteredItems[idx - 1].id);
              const nextSelected = idx < filteredItems.length - 1 && selectedIds.has(filteredItems[idx + 1].id);
              return (
              <SortableItemRow
                key={item.id}
                item={item}
                isEditing={editingId === item.id}
                isSelected={isSelected}
                isBulkMode={bulkMode}
                selectedTop={isSelected && !prevSelected}
                selectedBottom={isSelected && !nextSelected}
                suppressHover={suppressHover}
                isDragDisabled={isDragDisabled}
                onToggleRead={
                  isReadingListItem(item)
                    ? () =>
                        toggleReadMutation.mutate({
                          itemId: item.id,
                          read: !item.read,
                        })
                    : undefined
                }
                onSelect={(e) => {
                  if (editingId !== null) setEditingId(null);

                  if (e.metaKey || e.ctrlKey) {
                    // Cmd+click: toggle individual item in set
                    setBulkMode(true);
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    });
                  } else if (e.shiftKey && lastClickedRef.current) {
                    setBulkMode(true);
                    // Shift+click: range select from last clicked to this
                    const ids = filteredItems.map((i) => i.id);
                    const from = ids.indexOf(lastClickedRef.current);
                    const to = ids.indexOf(item.id);
                    if (from !== -1 && to !== -1) {
                      const [start, end] = from < to ? [from, to] : [to, from];
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        for (let i = start; i <= end; i++) next.add(ids[i]);
                        return next;
                      });
                    }
                  } else {
                    // Plain click: single select (toggle)
                    setBulkMode(false);
                    setSelectedIds((prev) =>
                      prev.size === 1 && prev.has(item.id)
                        ? new Set()
                        : new Set([item.id]),
                    );
                  }
                  lastClickedRef.current = item.id;
                  cursorRef.current = item.id;
                }}
                onStartEdit={() => setEditingId(item.id)}
                onSave={(fields) => void handleSave(item.id, fields)}
                onCancelEdit={() => setEditingId(null)}
                onDelete={() => void handleDeleteSingle(item.id)}
              />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      )}


      {/* Bulk tag dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent showCloseButton={false} className="gap-3 p-3 sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Tag {selectedIds.size} items</DialogTitle>
          </DialogHeader>
          <input
            autoFocus
            value={tagDialogInput}
            onChange={(e) => setTagDialogInput(e.target.value)}
            placeholder="tag1, tag2, ..."
            className="w-full rounded-md border border-input bg-input/20 px-2 py-1.5 text-xs outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const tagNames = tagDialogInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
                if (tagNames.length > 0) {
                  const ids = Array.from(selectedIds);
                  setPendingActions((n) => n + 1);
                  bulkTag(ids, tagNames).then(() => queryClient.invalidateQueries({ queryKey: ["items"] })).finally(() => setPendingActions((n) => n - 1));
                }
                setTagDialogOpen(false);
              }
            }}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={() => {
                const tagNames = tagDialogInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
                if (tagNames.length > 0) {
                  const ids = Array.from(selectedIds);
                  setPendingActions((n) => n + 1);
                  bulkTag(ids, tagNames).then(() => queryClient.invalidateQueries({ queryKey: ["items"] })).finally(() => setPendingActions((n) => n - 1));
                }
                setTagDialogOpen(false);
              }}
            >
              Add tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyboard shortcuts help dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent showCloseButton={false} className="gap-0 p-4 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription className="sr-only">List of keyboard shortcuts</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs mt-3">
            <span className="text-muted-foreground text-[11px] font-medium col-span-2 mt-1 first:mt-0">Navigation</span>
            <kbd className="font-mono text-muted-foreground">j / k</kbd><span>Move down / up</span>
            <kbd className="font-mono text-muted-foreground">Ctrl+N / P</kbd><span>Move down / up</span>
            <kbd className="font-mono text-muted-foreground">Shift+J / K</kbd><span>Extend selection down / up</span>
            <kbd className="font-mono text-muted-foreground">Ctrl+Shift+N / P</kbd><span>Extend selection down / up</span>
            <kbd className="font-mono text-muted-foreground">g g</kbd><span>Go to first item</span>
            <kbd className="font-mono text-muted-foreground">G</kbd><span>Go to last item</span>
            <kbd className="font-mono text-muted-foreground">Ctrl+D / U</kbd><span>Half-page down / up</span>

            <span className="text-muted-foreground text-[11px] font-medium col-span-2 mt-2">Selection</span>
            <kbd className="font-mono text-muted-foreground">v</kbd><span>Toggle visual mode</span>

            <span className="text-muted-foreground text-[11px] font-medium col-span-2 mt-2">Actions</span>
            <kbd className="font-mono text-muted-foreground">Enter</kbd><span>Edit selected item</span>
            <kbd className="font-mono text-muted-foreground">o</kbd><span>Open URL in new tab</span>
            <kbd className="font-mono text-muted-foreground">x</kbd><span>Toggle read</span>
            <kbd className="font-mono text-muted-foreground">Space</kbd><span>Toggle read</span>
            <kbd className="font-mono text-muted-foreground">Cmd+Enter</kbd><span>Open URL in new tab</span>
            <kbd className="font-mono text-muted-foreground">d d</kbd><span>Delete selected</span>
            <kbd className="font-mono text-muted-foreground">Cmd+Backspace</kbd><span>Delete selected</span>
            <kbd className="font-mono text-muted-foreground">Cmd+V</kbd><span>Quick-add URL from clipboard</span>

            <span className="text-muted-foreground text-[11px] font-medium col-span-2 mt-2">Other</span>
            <kbd className="font-mono text-muted-foreground">/</kbd><span>Search</span>
            <kbd className="font-mono text-muted-foreground">1 / 2</kbd><span>Reading List / Bookmarks</span>
            <kbd className="font-mono text-muted-foreground">Escape</kbd><span>Close / clear selection</span>
            <kbd className="font-mono text-muted-foreground">?</kbd><span>Show this help</span>
          </div>
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept=".html"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const html = await file.text();
          e.target.value = "";
          setPendingActions((n) => n + 1);
          try {
            await importBookmarks(html);
            queryClient.invalidateQueries({ queryKey: ["items"] });
          } finally {
            setPendingActions((n) => n - 1);
          }
        }}
      />

      <div className="fixed bottom-4 left-4 flex items-center gap-3 text-xs text-muted-foreground/50">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="hover:text-muted-foreground transition-colors cursor-pointer"
        >
          Import bookmarks
        </button>
        <span>·</span>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="hover:text-muted-foreground transition-colors cursor-pointer"
        >
          Shortcuts
        </button>
        <span>·</span>
        <button
          type="button"
          onClick={() => void logout()}
          className="hover:text-muted-foreground transition-colors cursor-pointer"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
