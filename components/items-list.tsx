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
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { isReadingListItem, type Item } from "@/lib/types";
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
import { Footer } from "./items-list/footer";
import { ItemFormDrawer } from "./items-list/item-form-drawer";
import { ItemActionsDrawer } from "./items-list/item-actions-drawer";
import { DetailPanel } from "./items-list/detail-panel";

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
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [scrolled, setScrolled] = React.useState(false);
  const [menuItemId, setMenuItemId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState(() =>
    searchParams.get("tab") === "bookmarks" ? "bookmarks" : "reading-list",
  );

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
      setSelectedIds,
      setEditingId,
      showRead,
      setCursor,
    });

  const { suppressHover, setSuppressHover } = useKeyboardNavigation({
    filteredItems,
    selectedIds,
    setSelectedIds,
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
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (args: { title: string; url: string; tagNames: string[]; notes?: string }) =>
      createItem(args.title, args.url, args.tagNames, undefined, tabType, args.notes),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; fields: { title?: string; url?: string; notes?: string; tagNames?: string[] } }) =>
      updateItem(args.id, args.fields),
    onSuccess: invalidate,
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
        createMutation.mutate({
          title: fields.title.trim() || fields.url.trim(),
          url: fields.url.trim(),
          tagNames,
          notes: fields.notes.trim() || undefined,
        });
      } else {
        updateMutation.mutate({
          id: itemId,
          fields: { title: fields.title, url: fields.url, notes: fields.notes, tagNames },
        });
      }

      setEditingId(null);
    },
    [createMutation, updateMutation],
  );

  const handleCreate = React.useCallback(
    (fields: EditFields) => {
      const tagNames = fields.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (!fields.title.trim() && !fields.url.trim()) return;
      createMutation.mutate({
        title: fields.title.trim() || fields.url.trim(),
        url: fields.url.trim(),
        tagNames,
        notes: fields.notes.trim() || undefined,
      });
      setEditingId(null);
    },
    [createMutation],
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
      const anyVisible = Array.from(selectedIds).some((id) =>
        filteredItems.some((i) => i.id === id),
      );
      if (!anyVisible) {
        setSelectedIds(new Set([filteredItems[0].id]));
        setCursor(filteredItems[0].id);
      }
    }
  }, [search, filteredItems, selectedIds, setCursor]);

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
      handleReorder(active.id as string, tabType, overIndex);
    },
    [tabItems, tabType, handleReorder],
  );

  // Derived state
  const isNewItem = editingId === "new";
  const detailItem =
    !isMobile && !isNewItem && selectedIds.size === 1
      ? (filteredItems.find((i) => i.id === [...selectedIds][0]) ?? null)
      : null;
  const showDetailPanel = !isMobile && (detailItem !== null || isNewItem);

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

        {/* Items list */}
        {isLoading ? (
          <div className="px-1 py-6 text-center text-muted-foreground text-xs">
            Loading...
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
                    item={item}
                    flashcardCount={flashcardCounts.get(item.id) ?? 0}
                    isEditing={isMobile && editingId === item.id}
                    isSelected={selectedIds.has(item.id)}
                    isMobile={isMobile}
                    suppressHover={suppressHover}
                    isDragDisabled={isDragDisabled}
                    onToggleRead={
                      isReadingListItem(item)
                        ? () => handleToggleRead(item.id, !item.read)
                        : undefined
                    }
                    onSelect={() => {
                      if (editingId !== null) setEditingId(null);
                      setSelectedIds(new Set([item.id]));
                      setCursor(item.id);
                    }}
                    onStartEdit={() => {
                      if (isMobile) {
                        setEditingId(item.id);
                      } else {
                        setSelectedIds(new Set([item.id]));
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
                    onDelete={() => handleDeleteSingle(item.id)}
                    onOpenMenu={
                      isMobile ? () => setMenuItemId(item.id) : undefined
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <Footer />

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
                  ? () => handleDeleteSingle(editingId)
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
                    if (menuItemId) handleDeleteSingle(menuItemId);
                    setMenuItemId(null);
                  }}
                />
              );
            })()}
          </>
        )}
      </div>

      {/* Desktop detail panel */}
      {showDetailPanel && (
        <DetailPanel
          item={detailItem}
          isNew={isNewItem}
          onSave={(itemId, fields) => handleSave(itemId, fields)}
          onFlashcardChange={() =>
            queryClient.invalidateQueries({ queryKey: ["flashcard-counts"] })
          }
          onCreate={handleCreate}
          onDelete={
            detailItem ? () => handleDeleteSingle(detailItem.id) : undefined
          }
        />
      )}
    </div>
  );
}
