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

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";
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
import { createItem, fetchPageTitle, updateItem, searchItems, searchFlashcards } from "@/app/actions";
import { findDuplicateItem } from "@/lib/url";
import { DuplicateDialog } from "./items-list/duplicate-dialog";
import { SortableItemRow } from "./items-list/sortable-item-row";
import { useItemsMutations } from "./items-list/use-mutations";
import { useItemsFilters, type TabId } from "./items-list/use-filters";
import { useKeyboardNavigation } from "./items-list/use-keyboard-navigation";
import { Toolbar } from "./items-list/toolbar";
import { TagFilters } from "./items-list/tag-filters";
import { ReviewNudge } from "./items-list/review-nudge";
import { DetailPanel } from "./items-list/detail-panel";
import { DetailPanelSkeleton } from "./items-list/detail-panel-skeleton";
import { CardsList, CardsStateBar } from "./items-list/cards-list";
import { GroupedList } from "./items-list/grouped-list";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchBar, type SearchBarHandle } from "./items-list/search-bar";

// Anchor offset (in px) matching the panel's `left: calc(50% + 18.75rem)` style.
const PANEL_LEFT_OFFSET_PX = 300;
// Width (in px) of the panel in collapsed state.
const COLLAPSED_PANEL_WIDTH_PX = 440;
// Visual width of inner content when expanded — keeps the form centered.
const EXPANDED_CONTENT_MAX_WIDTH_PX = 600;

const useViewportWidth = () => {
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
};

export const ItemsList = () => {
  // Data
  const viewportWidth = useViewportWidth();
  const [isPanelAnimating, setIsPanelAnimating] = React.useState(false);
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

  // Search
  const [searchIds, setSearchIds] = React.useState<Set<string> | null>(null);
  const searchBarRef = React.useRef<SearchBarHandle | null>(null);
  const handleSearchResults = React.useCallback((ids: Set<string> | null) => {
    setSearchIds(ids);
  }, []);
  const handleSearchOpen = React.useCallback(() => {
    searchBarRef.current?.open();
  }, []);

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
    groupBy,
    setGroupBy,
    groups,
  } = useItemsFilters(items, activeTab, searchIds);

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

  const handleSelectRow = React.useCallback(
    (id: string) => {
      if (editingId !== null) setEditingId(null);
      if (selectedId === id) {
        setSelectedId(null);
        setCursor(null);
      } else {
        setSelectedId(id);
        setCursor(id);
      }
      setLiveFields(null);
    },
    [editingId, selectedId, setCursor],
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

  // Mutations
  const animateTypingTitle = React.useCallback(
    (itemId: string, target: string) =>
      new Promise<void>((resolve) => {
        if (!target) {
          resolve();
          return;
        }
        let i = 0;
        setTypingTitles((prev) => ({ ...prev, [itemId]: "" }));
        const interval = setInterval(() => {
          i++;
          const partial = target.slice(0, i);
          setTypingTitles((prev) => ({ ...prev, [itemId]: partial }));
          if (i >= target.length) {
            clearInterval(interval);
            setTypingTitles((prev) => {
              const next = { ...prev };
              delete next[itemId];
              return next;
            });
            resolve();
          }
        }, 15);
      }),
    [],
  );

  type CreateArgs = {
    title: string;
    url: string;
    tagNames: string[];
    notes?: string;
    animateTitle?: boolean;
  };

  const createMutation = useMutation({
    mutationFn: (args: CreateArgs) =>
      createItem(
        args.title,
        args.url,
        args.tagNames,
        undefined,
        args.notes,
      ),
    onSuccess: async (itemId, vars) => {
      if (!vars.animateTitle || !itemId) return;
      invalidate();
      setTypingTitles((prev) => ({ ...prev, [itemId]: "" }));
      const fetched = await fetchPageTitle(vars.url);
      const fallback = (() => {
        try {
          return new URL(vars.url).hostname.replace(/^www\./, "");
        } catch {
          return vars.url;
        }
      })();
      const target = fetched?.trim() || fallback;
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        (old ?? []).map((it) =>
          it.id === itemId ? { ...it, title: target } : it,
        ),
      );
      await animateTypingTitle(itemId, target);
      await updateItem(itemId, { title: target });
    },
  });

  type CreateCallbacks = {
    onProceed?: () => void;
    onCreated?: (itemId: string) => void;
    onOpenExisting?: (existingId: string) => void;
  };

  const [duplicateDialog, setDuplicateDialog] = React.useState<{
    existing: Item;
    pending: CreateArgs;
    callbacks: CreateCallbacks;
  } | null>(null);

  const requestCreate = React.useCallback(
    (args: CreateArgs, callbacks: CreateCallbacks = {}) => {
      const existing = findDuplicateItem(items, args.url);
      if (existing) {
        setDuplicateDialog({ existing, pending: args, callbacks });
        return;
      }
      callbacks.onProceed?.();
      createMutation.mutate(args, {
        onSuccess: (newId) => {
          if (newId && callbacks.onCreated) callbacks.onCreated(newId);
        },
      });
    },
    [items, createMutation],
  );

  const requestPasteCreate = React.useCallback(
    (url: string, tagNames: string[]) => {
      requestCreate({ title: "", url, tagNames, animateTitle: true });
    },
    [requestCreate],
  );

  const handleDuplicateOpenExisting = React.useCallback(() => {
    if (!duplicateDialog) return;
    const id = duplicateDialog.existing.id;
    duplicateDialog.callbacks.onOpenExisting?.(id);
    setSelectedId(id);
    setEditingId(null);
    setDuplicateDialog(null);
  }, [duplicateDialog]);

  const handleDuplicateCreateAnyway = React.useCallback(() => {
    if (!duplicateDialog) return;
    const { pending, callbacks } = duplicateDialog;
    setDuplicateDialog(null);
    callbacks.onProceed?.();
    createMutation.mutate(pending, {
      onSuccess: (newId) => {
        if (newId && callbacks.onCreated) callbacks.onCreated(newId);
      },
    });
  }, [duplicateDialog, createMutation]);

  const handleDuplicateOpenChange = React.useCallback((open: boolean) => {
    if (!open) setDuplicateDialog(null);
  }, []);

  const { suppressHover, setSuppressHover } = useKeyboardNavigation({
    filteredItems,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    setActiveTabAndUrl,
    setTagsOpen,
    setShowRead,
    tabItems,
    cursorRef,
    setCursor,
    onRequestDelete: React.useCallback(() => {
      if (selectedId) requestDeleteItem(selectedId);
    }, [selectedId, requestDeleteItem]),
    activeTags,
    onPasteCreate: requestPasteCreate,
    onSearchOpen: handleSearchOpen,
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
        requestCreate(
          {
            title: fields.title.trim() || fields.url.trim(),
            url: fields.url.trim(),
            tagNames,
            notes: fields.notes.trim() || undefined,
          },
          {
            onProceed: () => setEditingId(null),
            onCreated: () => invalidate(),
            onOpenExisting: () => setEditingId(null),
          },
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
        setEditingId(null);
      }
    },
    [requestCreate, updateMutation, invalidate],
  );

  const handleCreate = React.useCallback(
    (fields: EditFields) => {
      const tagNames = fields.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (!fields.title.trim() && !fields.url.trim()) return;
      requestCreate(
        {
          title: fields.title.trim() || fields.url.trim(),
          url: fields.url.trim(),
          tagNames,
          notes: fields.notes.trim() || undefined,
        },
        {
          onProceed: () => setSelectedId(null),
          onCreated: async (newId) => {
            await queryClient.invalidateQueries({ queryKey: ["items"] });
            setEditingId(null);
            setSelectedId(newId);
          },
          onOpenExisting: () => setEditingId(null),
        },
      );
    },
    [requestCreate, queryClient],
  );

  // Effects
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // DnD
  const isDragDisabled =
    activeTags.size > 0 || editingId !== null || groupBy !== "none";

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
        const sorted = old.slice().sort((a, b) => a.position - b.position);
        const currentIndex = sorted.findIndex((i) => i.id === active.id);
        if (currentIndex === -1) return old;
        const [moved] = sorted.splice(currentIndex, 1);
        const clamped = Math.max(0, Math.min(overIndex, sorted.length));
        sorted.splice(clamped, 0, moved);
        return sorted.map((item, i) => ({ ...item, position: i }));
      });
      requestAnimationFrame(() => setJustDropped(false));

      handleReorder(active.id as string, overIndex);
    },
    [tabItems, handleReorder, queryClient],
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
  const emptyState = React.useMemo(() => {
    if (filteredItems.length > 0 || isNewItem) return null;
    if (tabItems.length === 0) return { message: "Nothing here yet", hasHiddenRead: false };

    const hiddenReadCount = !showRead
      ? tabItems.filter(
          (item) =>
            item.read &&
            (searchIds === null || searchIds.has(item.id)) &&
            (activeTags.size === 0 ||
              item.tags.some((t) => activeTags.has(t.name))),
        ).length
      : 0;

    if (hiddenReadCount > 0) {
      return {
        message: `${hiddenReadCount} read ${hiddenReadCount === 1 ? "item" : "items"} not shown`,
        hasHiddenRead: true,
      };
    }
    return { message: "No items match your filters", hasHiddenRead: false };
  }, [filteredItems, isNewItem, tabItems, showRead, activeTags, searchIds]);

  const emptyNode = emptyState && (
    <div className="px-1 py-6 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
      <span>{emptyState.message}</span>
      {emptyState.hasHiddenRead && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRead(true)}
        >
          Show read
        </Button>
      )}
    </div>
  );

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
              hasTags={allTags.length > 0}
              tagsOpen={tagsOpen}
              setTagsOpen={setTagsOpen}
              showRead={showRead}
              setShowRead={setShowRead}
              groupBy={groupBy}
              setGroupBy={setGroupBy}
              setEditingId={setEditingId}
            />

            <SearchBar
              ref={searchBarRef}
              queryKey={activeTab === "cards" ? "search-cards" : "search-items"}
              searchFn={activeTab === "cards" ? searchFlashcards : searchItems}
              onResults={handleSearchResults}
              placeholder={activeTab === "cards" ? "Search cards..." : "Search items..."}
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

            {activeTab === "cards" && <CardsStateBar />}

            {scrolled && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-b from-background to-transparent translate-y-full pointer-events-none" />
            )}
          </div>

          {/* Content */}
          {activeTab === "cards" ? (
            <CardsList
              searchIds={searchIds}
              onOpenItem={handleExpandItem}
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
          ) : groupBy !== "none" ? (
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
                emptyNode
              )}
              <GroupedList
                groups={groups}
                selectedId={selectedId}
                liveFields={liveFields}
                typingTitles={typingTitles}
                suppressHover={suppressHover}
                onSelect={handleSelectRow}
                onDelete={requestDeleteItem}
                onToggleRead={handleToggleRead}
              />
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
                    emptyNode
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
                      onToggleRead={() => handleToggleRead(item.id, !item.read)}
                      onSelect={() => handleSelectRow(item.id)}
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
            x: isFocused
              ? -(viewportWidth / 2 + PANEL_LEFT_OFFSET_PX)
              : 0,
            y: 0,
            width: isFocused ? viewportWidth : COLLAPSED_PANEL_WIDTH_PX,
          }}
          transition={{ type: "spring", visualDuration: 0.22, bounce: 0 }}
          onAnimationStart={() => setIsPanelAnimating(true)}
          onAnimationComplete={() => setIsPanelAnimating(false)}
          style={{ top: 20, left: "calc(50% + 18.75rem)" }}
          className={cn(
            "fixed z-20 h-[calc(100vh-2.5rem)] detail-panel-scroll bg-background",
            isPanelAnimating ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          <div
            className="mx-auto w-full"
            style={{ maxWidth: EXPANDED_CONTENT_MAX_WIDTH_PX }}
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
                onSave={handleSave}
                onCreate={handleCreate}
                onCancel={
                  !isFocused && isNewItem ? () => setEditingId(null) : undefined
                }
                onDelete={
                  panelItem ? () => requestDeleteItem(panelItem.id) : undefined
                }
                onToggleRead={
                  panelItem
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
          </div>
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
              {itemToDelete && itemToDelete.flashcardCount > 0 ? (
                <>
                  This will also delete{" "}
                  <span className="font-medium">
                    {itemToDelete.flashcardCount}
                  </span>{" "}
                  {itemToDelete.flashcardCount === 1
                    ? "flashcard"
                    : "flashcards"}
                  . This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to delete this item? This action cannot
                  be undone.
                </>
              )}
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

      <DuplicateDialog
        open={duplicateDialog !== null}
        onOpenChange={handleDuplicateOpenChange}
        existing={duplicateDialog?.existing ?? null}
        onOpenExisting={handleDuplicateOpenExisting}
        onCreateAnyway={handleDuplicateCreateAnyway}
      />
    </div>
  );
};
