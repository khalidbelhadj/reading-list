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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import React from "react";

import { createItem, updateItem } from "@/app/actions";
import { isReadingListItem } from "@/lib/types";
import { type EditFields, fetchItems } from "./items-list/utils";
import { SortableItemRow, InlineEditForm } from "./items-list/sortable-item-row";
import { useItemsMutations } from "./items-list/use-mutations";
import { useItemsFilters } from "./items-list/use-filters";
import { useKeyboardNavigation } from "./items-list/use-keyboard-navigation";
import { Toolbar } from "./items-list/toolbar";
import { TagFilters } from "./items-list/tag-filters";
import { Footer } from "./items-list/footer";
import { HelpDialog } from "./items-list/help-dialog";
import { BulkTagDialog } from "./items-list/bulk-tag-dialog";

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
  const [pendingActions, setPendingActions] = React.useState(0);
  const [bulkMode, setBulkMode] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);
  const [tagDialogInput, setTagDialogInput] = React.useState("");
  const [scrolled, setScrolled] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Shared refs used by both mutations and keyboard navigation
  const cursorRef = React.useRef<string | null>(null);
  const anchorRef = React.useRef<string | null>(null);
  const lastClickedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 0); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const {
    tabType, tabItems, allTags, filteredItems,
    activeTags, setActiveTags, toggleTag,
    tagsOpen, setTagsOpen, showRead, setShowRead,
    search, setSearch, searchOpen, setSearchOpen,
  } = useItemsFilters(items, activeTab);

  const {
    reorderMutation,
    toggleReadMutation,
    handleDeleteSingle,
    handleBulkDelete,
    handleBulkMarkRead,
    handleBulkMove,
  } = useItemsMutations({
    queryClient,
    filteredItems,
    selectedIds,
    setSelectedIds,
    setEditingId,
    setBulkMode,
    setPendingActions,
    showRead,
    tabType,
    cursorRef,
    anchorRef,
  });

  const { suppressHover, setSuppressHover } = useKeyboardNavigation({
    queryClient,
    filteredItems,
    selectedIds,
    setSelectedIds,
    editingId,
    setEditingId,
    bulkMode,
    setBulkMode,
    searchOpen,
    setSearch,
    setSearchOpen,
    searchInputRef,
    setActiveTabAndUrl,
    setHelpOpen,
    setTagsOpen,
    setShowRead,
    setTagDialogInput,
    setTagDialogOpen,
    tabType,
    handleBulkDelete,
    handleBulkMarkRead,
    handleBulkMove,
    handleDeleteSingle,
    toggleReadMutation,
    cursorRef,
    anchorRef,
    lastClickedRef,
  });

  // Auto-select first result when searching
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

  // DnD setup
  const isDragDisabled =
    search.trim().length > 0 || activeTags.size > 0 || editingId !== null || (bulkMode && selectedIds.size >= 1);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

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
        <Toolbar
          activeTab={activeTab}
          setActiveTabAndUrl={setActiveTabAndUrl}
          isFetching={isFetching}
          pendingActions={pendingActions}
          bulkMode={bulkMode}
          selectedIds={selectedIds}
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
          setBulkMode={setBulkMode}
          setSelectedIds={setSelectedIds}
          setTagDialogInput={setTagDialogInput}
          setTagDialogOpen={setTagDialogOpen}
          handleBulkMarkRead={handleBulkMarkRead}
          handleBulkMove={handleBulkMove}
          handleBulkDelete={handleBulkDelete}
        />

        {tagsOpen && allTags.length > 0 && (
          <TagFilters
            allTags={allTags}
            activeTags={activeTags}
            toggleTag={toggleTag}
            setActiveTags={setActiveTags}
          />
        )}

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
                onRightClick={() => {
                  if (editingId !== null) setEditingId(null);
                  if (bulkMode) {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      next.add(item.id);
                      return next;
                    });
                  } else {
                    setBulkMode(true);
                    setSelectedIds(new Set([item.id]));
                    anchorRef.current = item.id;
                  }
                  cursorRef.current = item.id;
                }}
                onSelect={(e) => {
                  if (editingId !== null) setEditingId(null);

                  if (e.metaKey || e.ctrlKey) {
                    if (!bulkMode) {
                      setBulkMode(true);
                      setSelectedIds(new Set([item.id]));
                    } else {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }
                  } else if (e.shiftKey && lastClickedRef.current) {
                    setBulkMode(true);
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

      <BulkTagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        selectedIds={selectedIds}
        queryClient={queryClient}
        setPendingActions={setPendingActions}
      />

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />

      <Footer
        items={items}
        queryClient={queryClient}
        setPendingActions={setPendingActions}
        setHelpOpen={setHelpOpen}
      />
    </div>
  );
}
