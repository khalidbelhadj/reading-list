"use client";

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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { IconFileFilled } from "@tabler/icons-react";
import Image from "next/image";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { isReadingListItem, type Item } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { getFaviconSrc } from "./items-list/utils";

type LiveFields = { title: string; url: string; notes: string; tags: string[] };
import { fetchItems } from "@/lib/queries";
import { type EditFields } from "./items-list/utils";
import { createItem, updateItem } from "@/app/actions";
import { SortableItemRow } from "./items-list/sortable-item-row";
import { useItemsMutations } from "./items-list/use-mutations";
import { useItemsFilters, type TabId } from "./items-list/use-filters";
import { useKeyboardNavigation } from "./items-list/use-keyboard-navigation";
import { Toolbar } from "./items-list/toolbar";
import { TagFilters } from "./items-list/tag-filters";
import { ReviewNudge } from "./items-list/review-nudge";
import { DetailPanel } from "./items-list/detail-panel";
import { DetailPanelSkeleton } from "./items-list/detail-panel-skeleton";
import { CardsList } from "./items-list/cards-list";
import { Skeleton } from "@/components/ui/skeleton";

export const ItemsList = () => {
  // Data
  const queryClient = useQueryClient();
  const {
    data: items,
    isLoading,
    isError: itemsError,
  } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  // UI state
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = React.useState<Item | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [justDropped, setJustDropped] = React.useState(false);
  const [liveFields, setLiveFields] = React.useState<LiveFields | null>(null);
  const [typingTitles, setTypingTitles] = React.useState<
    Record<string, string>
  >({});
  const [activeTab, setActiveTab] = React.useState<TabId>(() => {
    const tab = searchParams.get("tab");
    if (tab === "cards") return "cards";
    return "reading-list";
  });

  // Refs
  const cursorRef = React.useRef<string | null>(null);
  const setCursor = React.useCallback((id: string | null) => {
    cursorRef.current = id;
  }, []);

  // Helpers
  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["items"] });
  }, [queryClient]);

  const setActiveTabAndUrl = React.useCallback((tab: TabId) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === "reading-list") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `?${queryString}` : window.location.pathname,
    );
  }, []);

  const [focusedId, setFocusedId] = React.useState<string | null>(() =>
    searchParams.get("item"),
  );

  // Sync local state -> URL (so the page is shareable)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("item") === focusedId) return;
    if (focusedId) params.set("item", focusedId);
    else params.delete("item");
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `?${queryString}` : window.location.pathname,
    );
  }, [focusedId]);

  // popstate -> sync URL back into local state
  React.useEffect(() => {
    const handler = () => {
      setFocusedId(new URLSearchParams(window.location.search).get("item"));
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // Remember which tab the user opened the focused view from, so Back returns
  // them to that tab (e.g. open from Cards → back to Cards).
  const focusedFromTabRef = React.useRef<TabId | null>(null);

  const handleExpandItem = React.useCallback(
    (id: string) => {
      focusedFromTabRef.current = activeTab;
      setFocusedId(id);
    },
    [activeTab],
  );
  const handleCloseFocused = React.useCallback(() => {
    const fromTab = focusedFromTabRef.current;
    if (fromTab && fromTab !== activeTab) {
      setActiveTabAndUrl(fromTab);
    }
    focusedFromTabRef.current = null;
    // Select the item we were focused on, so the side panel renders at the
    // morph target position (otherwise the back morph has nowhere to land).
    if (focusedId) setSelectedId(focusedId);
    setFocusedId(null);
  }, [activeTab, focusedId, setActiveTabAndUrl]);

  // Hooks
  const {
    tabType,
    tabItems,
    allTags,
    filteredItems,
    activeTags,
    setActiveTags,
    toggleTag,
    tagsOpen,
    setTagsOpen,
    showRead,
    setShowRead,
  } = useItemsFilters(items, activeTab);

  const { handleReorder, handleToggleRead, handleDeleteSingle } =
    useItemsMutations({
      filteredItems,
      setSelectedId,
      setEditingId,
      showRead,
      setCursor,
    });

  const requestDeleteItem = React.useCallback(
    (id: string) => {
      const item = items?.find((i) => i.id === id) ?? null;
      if (!item) return;
      setItemToDelete(item);
      setDeleteOpen(true);
    },
    [items],
  );
  const confirmDelete = React.useCallback(async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      await handleDeleteSingle(itemToDelete.id);
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }, [itemToDelete, handleDeleteSingle]);

  const pendingFaviconSrc = itemToDelete ? getFaviconSrc(itemToDelete) : null;

  const { suppressHover, setSuppressHover } = useKeyboardNavigation({
    filteredItems,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    setActiveTabAndUrl,
    setTagsOpen,
    setShowRead,
    tabType,
    tabItems,
    cursorRef,
    setCursor,
    onRequestDelete: React.useCallback(() => {
      if (selectedId) requestDeleteItem(selectedId);
    }, [selectedId, requestDeleteItem]),
    activeTags,
    setTypingTitles,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (args: {
      title: string;
      url: string;
      tagNames: string[];
      notes?: string;
    }) =>
      createItem(
        args.title,
        args.url,
        args.tagNames,
        undefined,
        tabType,
        args.notes,
      ),
  });

  const updateMutation = useMutation({
    mutationFn: (args: {
      id: string;
      fields: {
        title?: string;
        url?: string;
        notes?: string;
        tagNames?: string[];
      };
    }) => updateItem(args.id, args.fields),
    onMutate: async ({ id, fields }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueryData<Item[]>(["items"]);
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        (old ?? []).map((item) => {
          if (item.id !== id) return item;
          const next = { ...item, updatedAt: new Date().toISOString() };
          if (fields.title !== undefined) next.title = fields.title;
          if (fields.url !== undefined) next.url = fields.url;
          if (fields.notes !== undefined) next.notes = fields.notes;
          if (fields.tagNames !== undefined) {
            const byName = new Map(item.tags.map((t) => [t.name, t]));
            next.tags = fields.tagNames.map(
              (name, i) =>
                byName.get(name) ?? { id: -(i + 1), userId: item.userId, name },
            );
          }
          return next;
        }),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(["items"], context.previous);
    },
    onSettled: invalidate,
  });

  const handleSave = React.useCallback(
    (itemId: string, fields: EditFields) => {
      const tagNames = fields.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      if (itemId === "new") {
        if (!fields.title.trim() && !fields.url.trim()) {
          setEditingId(null);
          return;
        }
        createMutation.mutate(
          {
            title: fields.title.trim() || fields.url.trim(),
            url: fields.url.trim(),
            tagNames,
            notes: fields.notes.trim() || undefined,
          },
          { onSuccess: invalidate },
        );
      } else {
        updateMutation.mutate({
          id: itemId,
          fields: {
            title: fields.title,
            url: fields.url,
            notes: fields.notes,
            tagNames,
          },
        });
      }

      setEditingId(null);
    },
    [createMutation, updateMutation, invalidate],
  );

  const handleCreate = React.useCallback(
    (fields: EditFields) => {
      const tagNames = fields.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (!fields.title.trim() && !fields.url.trim()) return;
      setSelectedId(null);
      createMutation.mutate(
        {
          title: fields.title.trim() || fields.url.trim(),
          url: fields.url.trim(),
          tagNames,
          notes: fields.notes.trim() || undefined,
        },
        {
          onSuccess: async (newId) => {
            await queryClient.invalidateQueries({ queryKey: ["items"] });
            setEditingId(null);
            setSelectedId(newId);
          },
          onError: () => setEditingId(null),
        },
      );
    },
    [createMutation, queryClient],
  );

  // Effects
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // DnD
  const isDragDisabled = activeTags.size > 0 || editingId !== null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const overIndex = tabItems.findIndex((i) => i.id === over.id);
      if (overIndex === -1) return;

      setJustDropped(true);
      queryClient.setQueryData<Item[]>(["items"], (old) => {
        if (!old) return old;
        const typeArr = old
          .filter((i) => i.type === tabType)
          .sort((a, b) => a.position - b.position);
        const rest = old.filter((i) => i.type !== tabType);
        const currentIndex = typeArr.findIndex((i) => i.id === active.id);
        if (currentIndex === -1) return old;
        const [moved] = typeArr.splice(currentIndex, 1);
        const clamped = Math.max(0, Math.min(overIndex, typeArr.length));
        typeArr.splice(clamped, 0, moved);
        return [
          ...typeArr.map((item, i) => ({ ...item, position: i })),
          ...rest,
        ];
      });
      requestAnimationFrame(() => setJustDropped(false));

      handleReorder(active.id as string, tabType, overIndex);
    },
    [tabItems, tabType, handleReorder, queryClient],
  );

  // Derived state
  const isNewItem = editingId === "new";
  const detailItem =
    !isNewItem && selectedId !== null
      ? (filteredItems.find((i) => i.id === selectedId) ?? null)
      : null;
  const showDetailPanel =
    activeTab !== "cards" && (detailItem !== null || isNewItem);

  const focusedItem = focusedId
    ? (items?.find((i) => i.id === focusedId) ?? null)
    : null;

  const isFocused = !!focusedId;
  const panelItem = isFocused ? focusedItem : detailItem;
  const panelVisible = showDetailPanel || isFocused;

  // Empty state message
  const emptyMessage = React.useMemo(() => {
    if (filteredItems.length > 0 || isNewItem) return null;
    if (tabItems.length === 0) return "Nothing here yet";

    const hiddenReadCount = !showRead
      ? tabItems.filter(
          (item) =>
            isReadingListItem(item) &&
            item.read &&
            (activeTags.size === 0 ||
              item.tags.some((t) => activeTags.has(t.name))),
        ).length
      : 0;

    if (hiddenReadCount > 0) {
      return `${hiddenReadCount} read ${hiddenReadCount === 1 ? "item" : "items"} not shown`;
    }
    return "No items match your filters";
  }, [filteredItems, isNewItem, tabItems, showRead, activeTags]);

  return (
    <div className="relative">
      <div
        className={cn(
          "transition-opacity duration-200",
          focusedId &&
            "fixed inset-0 opacity-0 pointer-events-none overflow-hidden",
        )}
        aria-hidden={focusedId ? true : undefined}
      >
        <div className="mx-auto max-w-150 px-5 pb-5 flex flex-col gap-3">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 flex flex-col gap-3 pt-5 bg-background">
            <Toolbar
              activeTab={activeTab}
              setActiveTabAndUrl={setActiveTabAndUrl}
              tabType={tabType}
              hasTags={allTags.length > 0}
              tagsOpen={tagsOpen}
              setTagsOpen={setTagsOpen}
              showRead={showRead}
              setShowRead={setShowRead}
              setEditingId={setEditingId}
            />

            <ReviewNudge />

            {tagsOpen && allTags.length > 0 && activeTab !== "cards" && (
              <TagFilters
                allTags={allTags}
                activeTags={activeTags}
                items={tabItems}
                toggleTag={toggleTag}
                setActiveTags={setActiveTags}
              />
            )}

            {scrolled && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-b from-background to-transparent translate-y-full pointer-events-none" />
            )}
          </div>

          {/* Content */}
          {activeTab === "cards" ? (
            <CardsList
              onOpenItem={(id) => {
                focusedFromTabRef.current = activeTab;
                setFocusedId(id);
              }}
            />
          ) : isLoading ? (
            <div className="flex flex-col">
              {Array.from({ length: 15 }).map((_, i) => {
                // Pseudo-random-but-stable widths so rows don't look uniform.
                const titleWidth = 30 + ((i * 17) % 55);
                return (
                  <div
                    key={i}
                    style={{ opacity: Math.max(1 - i * 0.07, 0.1) }}
                    className="flex items-center gap-2 p-1 h-7"
                  >
                    <Skeleton className="size-4 rounded-[3px] shrink-0" />
                    <Skeleton
                      className="h-3 rounded-md"
                      style={{ width: `${titleWidth}%` }}
                    />
                  </div>
                );
              })}
            </div>
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
                <div
                  onMouseMove={
                    suppressHover ? () => setSuppressHover(false) : undefined
                  }
                >
                  {itemsError ? (
                    <div className="px-1 py-6 text-center text-destructive text-xs">
                      Failed to load items
                    </div>
                  ) : (
                    emptyMessage && (
                      <div className="px-1 py-6 text-center text-muted-foreground text-xs">
                        {emptyMessage}
                      </div>
                    )
                  )}
                  {filteredItems.map((item) => {
                    const typingTitle = typingTitles[item.id];
                    const rowItem =
                      typingTitle !== undefined
                        ? { ...item, title: typingTitle }
                        : selectedId === item.id && liveFields
                          ? {
                              ...item,
                              title: liveFields.title,
                              url: liveFields.url,
                              notes: liveFields.notes,
                              tags: liveFields.tags.map((name, i) => ({
                                id: i,
                                name,
                                userId: item.userId,
                              })),
                            }
                          : item;
                    return (
                    <SortableItemRow
                      key={item.id}
                      item={rowItem}
                      flashcardCount={item.flashcardCount}
                      isEditing={false}
                      isSelected={selectedId === item.id}
                      suppressHover={suppressHover}
                      isDragDisabled={isDragDisabled}
                      isTyping={typingTitle !== undefined}
                      suppressTransition={justDropped}
                      onToggleRead={
                        isReadingListItem(item)
                          ? () => handleToggleRead(item.id, !item.read)
                          : undefined
                      }
                      onSelect={() => {
                        if (editingId !== null) setEditingId(null);
                        if (selectedId === item.id) {
                          setSelectedId(null);
                          setCursor(null);
                        } else {
                          setSelectedId(item.id);
                          setCursor(item.id);
                        }
                        setLiveFields(null);
                      }}
                      onSave={(fields) => handleSave(item.id, fields)}
                      onCancelEdit={() => setEditingId(null)}
                      onDelete={() => requestDeleteItem(item.id)}
                    />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {panelVisible && (
        <motion.div
          data-detail-panel
          initial={false}
          animate={{
            x: isFocused ? -600 : 0,
            y: 0,
            width: isFocused ? 600 : 380,
          }}
          transition={{ type: "spring", visualDuration: 0.22, bounce: 0 }}
          style={{ top: 20, left: "calc(50% + 18.75rem)" }}
          className="fixed z-20 max-h-[calc(100vh-5rem)] overflow-y-auto detail-panel-scroll bg-background"
        >
          {isFocused && !focusedItem ? (
            <DetailPanelSkeleton />
          ) : (
            <DetailPanel
              key={panelItem?.id ?? "new"}
              focused={isFocused}
              item={panelItem}
              isNew={!isFocused && isNewItem}
              defaultTags={
                !isFocused && isNewItem ? [...activeTags] : undefined
              }
              onSave={(itemId, fields) => handleSave(itemId, fields)}
              onCreate={handleCreate}
              onCancel={
                !isFocused && isNewItem ? () => setEditingId(null) : undefined
              }
              onDelete={
                panelItem ? () => requestDeleteItem(panelItem.id) : undefined
              }
              onToggleRead={
                panelItem && isReadingListItem(panelItem)
                  ? () => handleToggleRead(panelItem.id, !panelItem.read)
                  : undefined
              }
              onExpand={
                isFocused
                  ? handleCloseFocused
                  : detailItem
                    ? () => handleExpandItem(detailItem.id)
                    : undefined
              }
              onFieldsChange={setLiveFields}
            />
          )}
        </motion.div>
      )}

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteOpen(false);
        }}
      >
        <AlertDialogContent
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !deleting) {
              e.preventDefault();
              confirmDelete();
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {itemToDelete && (
            <div className="flex items-center gap-2 rounded-md bg-card px-1 py-1 ring-1 ring-foreground/5 min-w-0 overflow-hidden">
              <div className="size-5 shrink-0 flex items-center justify-center">
                {pendingFaviconSrc ? (
                  <Image
                    src={pendingFaviconSrc}
                    alt=""
                    width={20}
                    height={20}
                    className="size-5 rounded"
                    unoptimized
                  />
                ) : (
                  <IconFileFilled className="size-5 text-muted-foreground" />
                )}
              </div>
              <span className="font-content text-sm truncate">
                {itemToDelete.title || "Untitled"}
              </span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleting && <Spinner className="size-3.5" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
