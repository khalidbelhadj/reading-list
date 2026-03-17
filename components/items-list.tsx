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

import { useStore } from "@/lib/store";
import { useItems, useIsHydrated } from "@/lib/store/selectors";
import { isReadingListItem } from "@/lib/types";
import useIsMobile from "@/lib/use-is-mobile";
import { type EditFields } from "./items-list/utils";
import { SortableItemRow, InlineEditForm } from "./items-list/sortable-item-row";
import { useItemsMutations } from "./items-list/use-mutations";
import { useItemsFilters } from "./items-list/use-filters";
import { useKeyboardNavigation } from "./items-list/use-keyboard-navigation";
import { Toolbar } from "./items-list/toolbar";
import { TagFilters } from "./items-list/tag-filters";
import { Footer } from "./items-list/footer";
import { HelpDialog } from "./items-list/help-dialog";
import { BulkTagDialog } from "./items-list/bulk-tag-dialog";
import { ItemFormDrawer } from "./items-list/item-form-drawer";
import { ItemActionsDrawer } from "./items-list/item-actions-drawer";

export function ItemsList() {
  const store = useStore();
  const items = useItems();
  const isHydrated = useIsHydrated();
  const { isMobile } = useIsMobile();

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
  const [bulkMode, setBulkMode] = React.useState(false);
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);
  const [, setTagDialogInput] = React.useState("");
  const [scrolled, setScrolled] = React.useState(false);
  const [menuItemId, setMenuItemId] = React.useState<string | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Shared refs used by both mutations and keyboard navigation
  const cursorRef = React.useRef<string | null>(null);
  const anchorRef = React.useRef<string | null>(null);
  const lastClickedRef = React.useRef<string | null>(null);
  const baseSelectionRef = React.useRef<Set<string>>(new Set());

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
    handleReorder,
    handleToggleRead,
    handleDeleteSingle,
    handleBulkDelete,
    handleBulkMarkRead,
    handleBulkMove,
  } = useItemsMutations({
    filteredItems,
    selectedIds,
    setSelectedIds,
    setEditingId,
    setBulkMode,
    showRead,
    tabType,
    cursorRef,
    anchorRef,
  });

  const { suppressHover, setSuppressHover } = useKeyboardNavigation({
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
    handleBulkMove,
    cursorRef,
    anchorRef,
    baseSelectionRef,
    setFocusedId,
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

    handleReorder(active.id as string, tabType, overIndex);
  }

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
        store.createItem({
          title: fields.title.trim() || fields.url.trim(),
          url: fields.url.trim(),
          tagNames,
          type: tabType,
          notes: fields.notes.trim() || undefined,
        });
      } else {
        store.updateItem(itemId, {
          title: fields.title,
          url: fields.url,
          notes: fields.notes,
          tagNames,
        });
      }

      setEditingId(null);
    },
    [tabType, store],
  );

  return (
    <div className="mx-auto max-w-150 px-5 pb-5 flex flex-col gap-3">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 relative flex flex-col gap-3 pt-5 bg-background">
        <Toolbar
          activeTab={activeTab}
          setActiveTabAndUrl={setActiveTabAndUrl}
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
          onToggleBulkMode={() => {
            if (bulkMode) {
              setBulkMode(false);
              setSelectedIds(new Set());
              setFocusedId(null);
              baseSelectionRef.current = new Set();
              cursorRef.current = null;
              anchorRef.current = null;
            } else {
              setBulkMode(true);
              baseSelectionRef.current = new Set(selectedIds);
            }
          }}
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

        {scrolled && <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-b from-background to-transparent translate-y-full pointer-events-none" />}
      </div>

      {/* New item inline form (desktop only) */}
      {editingId === "new" && !isMobile && (
        <InlineEditForm
          initialTitle=""
          initialUrl=""
          initialTags=""
          initialNotes=""
          faviconSrc={null}
          onSave={(fields) => handleSave("new", fields)}
          onCancel={() => setEditingId(null)}
        />
      )}

      {/* Items list */}
      {!isHydrated ? (
        <div className="px-1 py-6 text-center text-muted-foreground text-xs">Loading...</div>
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
            {filteredItems.length === 0 && editingId !== "new" && (() => {
              const q = search.toLowerCase().trim();
              const readCount = !showRead ? tabItems.filter((i) =>
                isReadingListItem(i) && i.read
                && (!q || i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q))
                && (activeTags.size === 0 || i.tags.some((t) => activeTags.has(t.name)))
              ).length : 0;
              return (
                <div className="px-1 py-6 text-center text-muted-foreground text-xs">
                  {tabItems.length === 0
                    ? "Nothing here yet"
                    : readCount > 0
                      ? `${readCount} read ${readCount === 1 ? "item" : "items"} not shown`
                      : "No items match your filters"}
                </div>
              );
            })()}
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
                isFocused={bulkMode && focusedId === item.id && !isSelected}
                isBulkMode={bulkMode}
                isMobile={isMobile}
                selectedTop={isSelected && !prevSelected}
                selectedBottom={isSelected && !nextSelected}
                suppressHover={suppressHover}
                isDragDisabled={isDragDisabled}
                onToggleRead={
                  !bulkMode && isReadingListItem(item)
                    ? () => handleToggleRead(item.id, !item.read)
                    : undefined
                }
                onRightClick={() => {
                  if (editingId !== null) setEditingId(null);
                  let newSelection: Set<string>;
                  if (bulkMode) {
                    newSelection = new Set(selectedIds);
                    newSelection.add(item.id);
                  } else {
                    setBulkMode(true);
                    newSelection = new Set([item.id]);
                  }
                  setSelectedIds(newSelection);
                  baseSelectionRef.current = newSelection;
                  anchorRef.current = item.id;
                  cursorRef.current = item.id;
                  setFocusedId(item.id);
                }}
                onSelect={(e: React.MouseEvent) => {
                  if (editingId !== null) setEditingId(null);

                  if (bulkMode) {
                    let newSelection: Set<string>;
                    if (e.shiftKey && lastClickedRef.current) {
                      // Range select: add range from lastClicked to this item on top of base
                      const ids = filteredItems.map((i) => i.id);
                      const fromIdx = ids.indexOf(lastClickedRef.current);
                      const toIdx = ids.indexOf(item.id);
                      if (fromIdx !== -1 && toIdx !== -1) {
                        const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
                        newSelection = new Set(baseSelectionRef.current);
                        for (let i = start; i <= end; i++) newSelection.add(ids[i]);
                      } else {
                        newSelection = new Set(selectedIds);
                      }
                    } else {
                      // Toggle selection
                      newSelection = new Set(selectedIds);
                      if (newSelection.has(item.id)) newSelection.delete(item.id);
                      else newSelection.add(item.id);
                      // Lock in selection as new base
                      baseSelectionRef.current = newSelection;
                    }
                    setSelectedIds(newSelection);
                  } else {
                    const newSelection = selectedIds.size === 1 && selectedIds.has(item.id)
                      ? new Set<string>()
                      : new Set([item.id]);
                    setSelectedIds(newSelection);
                    baseSelectionRef.current = newSelection;
                  }
                  lastClickedRef.current = item.id;
                  cursorRef.current = item.id;
                  anchorRef.current = item.id;
                  setFocusedId(item.id);
                }}
                onStartEdit={() => setEditingId(item.id)}
                onSave={(fields) => handleSave(item.id, fields)}
                onCancelEdit={() => setEditingId(null)}
                onDelete={() => handleDeleteSingle(item.id)}
                onOpenMenu={isMobile ? () => setMenuItemId(item.id) : undefined}
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
      />

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />

      <Footer
        setHelpOpen={setHelpOpen}
      />

      {/* Mobile drawers */}
      {isMobile && (
        <>
          <ItemFormDrawer
            open={editingId !== null}
            isNew={editingId === "new"}
            item={editingId && editingId !== "new" ? items?.find((i) => i.id === editingId) ?? null : null}
            onSave={(fields) => handleSave(editingId!, fields)}
            onCancel={() => setEditingId(null)}
            onDelete={editingId && editingId !== "new" ? () => handleDeleteSingle(editingId) : undefined}
          />
          {(() => {
            const menuItem = menuItemId ? items?.find((i) => i.id === menuItemId) ?? null : null;
            return (
              <ItemActionsDrawer
                item={menuItem}
                open={menuItemId !== null}
                onOpenChange={(open) => { if (!open) setMenuItemId(null); }}
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
  );
}
