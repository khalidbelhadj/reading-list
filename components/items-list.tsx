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
import { useRouter, useSearchParams } from "next/navigation";
import { IconFileFilled } from "@tabler/icons-react";
import Image from "next/image";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
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

import { getFaviconSrc, resolveRowItem } from "./items-list/utils";

import { fetchItems } from "@/lib/queries";
import { useInvalidateItems } from "./items-list/use-invalidate-items";
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
import { CardsList, CardsStateBar } from "./items-list/cards-list";
import { GroupedList } from "./items-list/grouped-list";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchBar, type SearchBarHandle } from "./items-list/search-bar";

export const ItemsList = () => {
  // Data
  const router = useRouter();
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
  const [itemToDelete, setItemToDelete] = React.useState<Item | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [justDropped, setJustDropped] = React.useState(false);
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
  const invalidate = useInvalidateItems();

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

  const handleOpenItem = React.useCallback(
    (id: string) => {
      router.push(`/item/${id}`);
    },
    [router],
  );

  const handleOpenNew = React.useCallback(() => {
    router.push("/new");
  }, [router]);

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
    setActiveTabAndUrl,
    setTagsOpen,
    setShowRead,
    tabItems,
    cursorRef,
    setCursor,
    onRequestDelete: React.useCallback(() => {
      const cursor = cursorRef.current;
      if (cursor) requestDeleteItem(cursor);
    }, [requestDeleteItem]),
    activeTags,
    onOpenItem: handleOpenItem,
    onOpenNew: handleOpenNew,
    onPasteCreate: requestPasteCreate,
    onSearchOpen: handleSearchOpen,
    onReorder: handleReorder,
  });

  // Effects
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    if (!items) return;
    router.prefetch("/new");
    for (const item of items) {
      router.prefetch(`/item/${item.id}`);
    }
  }, [items, router]);

  // DnD
  const isDragDisabled = activeTags.size > 0 || groupBy !== "none";

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

  // Empty state message
  const emptyState = React.useMemo(() => {
    if (filteredItems.length > 0) return null;
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
  }, [filteredItems, tabItems, showRead, activeTags, searchIds]);

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
    <div>
      <div className="mx-auto max-w-175 px-5 pb-5 flex flex-col gap-3">
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
            onAdd={handleOpenNew}
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
            onOpenItem={handleOpenItem}
          />
        ) : isLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 15 }).map((_, i) => {
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
              typingTitles={typingTitles}
              suppressHover={suppressHover}
              onSelect={handleOpenItem}
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
                  const rowItem = resolveRowItem(item, typingTitle);
                  return (
                  <SortableItemRow
                    key={item.id}
                    item={rowItem}
                    suppressHover={suppressHover}
                    isDragDisabled={isDragDisabled}
                    isTyping={typingTitle !== undefined}
                    suppressTransition={justDropped}
                    onToggleRead={() => handleToggleRead(item.id, !item.read)}
                    onSelect={() => handleOpenItem(item.id)}
                    onDelete={() => requestDeleteItem(item.id)}
                  />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

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
