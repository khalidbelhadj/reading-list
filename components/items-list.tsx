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
import { AnimatePresence, motion } from "motion/react";
import { IconArrowLeft, IconFile } from "@tabler/icons-react";
import Image from "next/image";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { isReadingListItem, type Item } from "@/lib/types";
import { Button } from "@/components/ui/button";
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
import useIsMobile from "@/lib/use-is-mobile";
import { type EditFields } from "./items-list/utils";
import { createItem, updateItem, getFlashcardCounts } from "@/app/actions";
import { SortableItemRow } from "./items-list/sortable-item-row";
import { useItemsMutations } from "./items-list/use-mutations";
import { useItemsFilters } from "./items-list/use-filters";
import { useKeyboardNavigation } from "./items-list/use-keyboard-navigation";
import { Toolbar } from "./items-list/toolbar";
import { TagFilters } from "./items-list/tag-filters";
import { ItemFormDrawer } from "./items-list/item-form-drawer";
import { ItemActionsDrawer } from "./items-list/item-actions-drawer";
import { DetailPanel } from "./items-list/detail-panel";
import { DetailPanelSkeleton } from "./items-list/detail-panel-skeleton";
import { CardsList } from "./items-list/cards-list";
import { Skeleton } from "@/components/ui/skeleton";

export const ItemsList = () => {
  // Data
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });
  const { data: flashcardCounts = new Map() } = useQuery({
    queryKey: ["flashcard-counts"],
    queryFn: getFlashcardCounts,
  });
  const { isMobile } = useIsMobile();

  // UI state
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [menuItemId, setMenuItemId] = React.useState<string | null>(null);
  const [justDropped, setJustDropped] = React.useState(false);
  const [liveFields, setLiveFields] = React.useState<LiveFields | null>(null);
  const [activeTab, setActiveTab] = React.useState(() => {
    const tab = searchParams.get("tab");
    if (tab === "cards") return tab;
    return "reading-list";
  });

  // Refs
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const cursorRef = React.useRef<string | null>(null);
  const setCursor = React.useCallback((id: string | null) => {
    cursorRef.current = id;
  }, []);

  // Helpers
  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["items"] });
  }, [queryClient]);

  const setActiveTabAndUrl = React.useCallback((tab: string) => {
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
  const focusedFromTabRef = React.useRef<string | null>(null);

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
    search,
    setSearch,
    searchOpen,
    setSearchOpen,
  } = useItemsFilters(items, activeTab);

  const { handleReorder, handleToggleRead, handleDeleteSingle } =
    useItemsMutations({
      filteredItems,
      setSelectedId,
      setEditingId,
      showRead,
      setCursor,
    });

  const requestDeleteItem = React.useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);
  const pendingDeleteItem = pendingDeleteId
    ? items?.find((i) => i.id === pendingDeleteId) ?? null
    : null;
  const confirmDelete = React.useCallback(async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await handleDeleteSingle(pendingDeleteId);
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, handleDeleteSingle]);

  // Cmd+Enter confirms delete when the dialog is open.
  React.useEffect(() => {
    if (!pendingDeleteId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !deleting) {
        e.preventDefault();
        confirmDelete();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pendingDeleteId, deleting, confirmDelete]);

  const pendingFaviconSrc = pendingDeleteItem
    ? getFaviconSrc(pendingDeleteItem)
    : null;

  const { suppressHover, setSuppressHover } = useKeyboardNavigation({
    filteredItems,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    searchOpen,
    setSearch,
    setSearchOpen,
    searchInputRef,
    setActiveTabAndUrl,
    setTagsOpen,
    setShowRead,
    tabType,
    tabItems,
    cursorRef,
    setCursor,
    onRequestDelete: React.useCallback(() => {
      if (selectedId) setPendingDeleteId(selectedId);
    }, [selectedId]),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (args: { title: string; url: string; tagNames: string[]; notes?: string }) =>
      createItem(args.title, args.url, args.tagNames, undefined, tabType, args.notes),
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; fields: { title?: string; url?: string; notes?: string; tagNames?: string[] } }) =>
      updateItem(args.id, args.fields),
    onError: invalidate,
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
          fields: { title: fields.title, url: fields.url, notes: fields.notes, tagNames },
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

  React.useEffect(() => {
    if (search.trim() && filteredItems.length > 0) {
      const anyVisible = selectedId !== null && filteredItems.some((i) => i.id === selectedId);
      if (!anyVisible) {
        setSelectedId(filteredItems[0].id);
        setCursor(filteredItems[0].id);
      }
    }
  }, [search, filteredItems, selectedId, setCursor]);

  // DnD
  const isDragDisabled =
    search.trim().length > 0 || activeTags.size > 0 || editingId !== null;

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
        return [...typeArr.map((item, i) => ({ ...item, position: i })), ...rest];
      });
      requestAnimationFrame(() => setJustDropped(false));

      handleReorder(active.id as string, tabType, overIndex);
    },
    [tabItems, tabType, handleReorder, queryClient],
  );

  // Derived state
  const isNewItem = editingId === "new";
  const detailItem =
    !isMobile && !isNewItem && selectedId !== null
      ? (filteredItems.find((i) => i.id === selectedId) ?? null)
      : null;
  const showDetailPanel = !isMobile && activeTab !== "cards" && (detailItem !== null || isNewItem);

  const focusedItem =
    !isMobile && focusedId
      ? (items?.find((i) => i.id === focusedId) ?? null)
      : null;

  // Empty state message
  const emptyMessage = React.useMemo(() => {
    if (filteredItems.length > 0 || isNewItem) return null;
    if (tabItems.length === 0) return "Nothing here yet";

    const searchQuery = search.toLowerCase().trim();
    const hiddenReadCount = !showRead
      ? tabItems.filter(
          (item) =>
            isReadingListItem(item) &&
            item.read &&
            (!searchQuery ||
              item.title.toLowerCase().includes(searchQuery) ||
              item.url.toLowerCase().includes(searchQuery)) &&
            (activeTags.size === 0 ||
              item.tags.some((t) => activeTags.has(t.name))),
        ).length
      : 0;

    if (hiddenReadCount > 0) {
      return `${hiddenReadCount} read ${hiddenReadCount === 1 ? "item" : "items"} not shown`;
    }
    return "No items match your filters";
  }, [filteredItems, isNewItem, tabItems, search, showRead, activeTags]);

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
            searchOpen={searchOpen}
            setSearchOpen={setSearchOpen}
            search={search}
            setSearch={setSearch}
            searchInputRef={searchInputRef}
            allTags={allTags}
            tagsOpen={tagsOpen}
            setTagsOpen={setTagsOpen}
            activeTags={activeTags}
            showRead={showRead}
            setShowRead={setShowRead}
            setEditingId={setEditingId}
            isMobile={isMobile}
          />

          {tagsOpen && allTags.length > 0 && (
            <TagFilters
              allTags={allTags}
              activeTags={activeTags}
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
              setActiveTabAndUrl("reading-list");
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
                {emptyMessage && (
                  <div className="px-1 py-6 text-center text-muted-foreground text-xs">
                    {emptyMessage}
                  </div>
                )}
                {filteredItems.map((item) => (
                  <SortableItemRow
                    key={item.id}
                    item={selectedId === item.id && liveFields
                      ? { ...item, title: liveFields.title, url: liveFields.url, notes: liveFields.notes, tags: liveFields.tags.map((name, i) => ({ id: i, name, userId: item.userId })) }
                      : item}
                    flashcardCount={flashcardCounts.get(item.id) ?? 0}
                    isEditing={isMobile && editingId === item.id}
                    isSelected={selectedId === item.id}
                    isMobile={isMobile}
                    suppressHover={suppressHover}
                    isDragDisabled={isDragDisabled}
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
                    onStartEdit={() => {
                      if (isMobile) {
                        setEditingId(item.id);
                      } else {
                        setSelectedId(item.id);
                        requestAnimationFrame(() => {
                          document
                            .querySelector<HTMLInputElement>(
                              "[data-detail-title]",
                            )
                            ?.focus();
                        });
                      }
                    }}
                    onSave={(fields) => handleSave(item.id, fields)}
                    onCancelEdit={() => setEditingId(null)}
                    onDelete={() => requestDeleteItem(item.id)}
                    onOpenMenu={() => setMenuItemId(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Mobile drawers */}
        {isMobile && (
          <>
            <ItemFormDrawer
              open={editingId !== null}
              isNew={isNewItem}
              item={
                editingId && editingId !== "new"
                  ? (items?.find((i) => i.id === editingId) ?? null)
                  : null
              }
              onSave={(fields) => handleSave(editingId!, fields)}
              onCancel={() => setEditingId(null)}
              onDelete={
                editingId && editingId !== "new"
                  ? () => requestDeleteItem(editingId)
                  : undefined
              }
            />
            {(() => {
              const menuItem = menuItemId
                ? (items?.find((i) => i.id === menuItemId) ?? null)
                : null;
              return (
                <ItemActionsDrawer
                  item={menuItem}
                  open={menuItemId !== null}
                  onOpenChange={(open) => {
                    if (!open) setMenuItemId(null);
                  }}
                  onEdit={() => {
                    setEditingId(menuItemId);
                    setMenuItemId(null);
                  }}
                  onToggleRead={
                    menuItem && isReadingListItem(menuItem)
                      ? (read: boolean) => handleToggleRead(menuItemId!, read)
                      : undefined
                  }
                  onDelete={() => {
                    if (menuItemId) requestDeleteItem(menuItemId);
                    setMenuItemId(null);
                  }}
                />
              );
            })()}
          </>
        )}
      </div>

      {/* Desktop detail panel — unmounts in focused mode so layoutId can pair */}
      {showDetailPanel && !focusedId && (
        <motion.div
          layoutId="item-card"
          layoutDependency="side"
          transition={{ type: "spring", visualDuration: 0.22, bounce: 0 }}
          data-detail-panel
          className="w-80 fixed top-5 max-h-[calc(100vh-2.5rem)] overflow-y-auto detail-panel-scroll"
          style={{ left: "calc(50% + 19.5rem)" }}
        >
          <DetailPanel
            item={detailItem}
            isNew={isNewItem}
            onSave={(itemId, fields) => handleSave(itemId, fields)}
            onFlashcardChange={() =>
              queryClient.invalidateQueries({ queryKey: ["flashcard-counts"] })
            }
            onCreate={handleCreate}
            onCancel={isNewItem ? () => setEditingId(null) : undefined}
            onDelete={
              detailItem ? () => requestDeleteItem(detailItem.id) : undefined
            }
            onToggleRead={
              detailItem && isReadingListItem(detailItem)
                ? () => handleToggleRead(detailItem.id, !detailItem.read)
                : undefined
            }
            onExpand={detailItem ? () => handleExpandItem(detailItem.id) : undefined}
            onFieldsChange={setLiveFields}
          />
        </motion.div>
      )}
      </div>

      {/* Focused item overlay */}
      <AnimatePresence initial={false}>
        {focusedId && (
          <div className="fixed inset-0 z-20 overflow-y-auto px-5 pb-5 pt-5">
            <div className="mx-auto max-w-150 flex flex-col gap-3">
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ type: "spring", visualDuration: 0.18, bounce: 0.1 }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={handleCloseFocused}
                >
                  <IconArrowLeft />
                  Back
                </Button>
              </motion.div>
              <motion.div
                layoutId="item-card"
                layoutDependency="focused"
                transition={{ type: "spring", visualDuration: 0.22, bounce: 0 }}
                data-detail-panel
                className="w-full"
              >
                {focusedItem ? (
                  <DetailPanel
                    focused
                    item={focusedItem}
                    isNew={false}
                    onSave={(itemId, fields) => handleSave(itemId, fields)}
                    onFlashcardChange={() =>
                      queryClient.invalidateQueries({
                        queryKey: ["flashcard-counts"],
                      })
                    }
                    onCreate={handleCreate}
                    onDelete={() => requestDeleteItem(focusedItem.id)}
                    onToggleRead={
                      isReadingListItem(focusedItem)
                        ? () =>
                            handleToggleRead(focusedItem.id, !focusedItem.read)
                        : undefined
                    }
                    onFieldsChange={setLiveFields}
                  />
                ) : (
                  <DetailPanelSkeleton />
                )}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingDeleteItem && (
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
                  <IconFile className="size-5 text-muted-foreground" />
                )}
              </div>
              <span className="font-content text-sm truncate">
                {pendingDeleteItem.title || "Untitled"}
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
              {deleting ? <Spinner className="size-3.5" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
