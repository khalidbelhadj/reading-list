import { useQuery } from "@tanstack/react-query";
import React from "react";

import { Button } from "@/components/ui/button";
import { LoadingFade } from "@/components/ui/loading-fade";
import { NonIdealState } from "@/components/ui/non-ideal-state";
import { openChatWithClaude } from "@/lib/chat-with-claude";
import { fetchItems } from "@/lib/queries";
import { subscribeRevealItem } from "@/lib/reveal-events";
import { type Item } from "@/lib/types";
import { useDismissLayer } from "@/lib/use-dismiss-layer";
import { useSettings } from "@/lib/use-settings";
import { cn } from "@/lib/utils";

import { AskResults } from "./items-list/ask-results";
import { getOpenItemId } from "./items-list/cursor-store";
import { DeleteItemsDialog } from "./items-list/delete-item-dialog";
import { DuplicateDialog } from "./items-list/duplicate-dialog";
import { GroupedList } from "./items-list/grouped-list";
import {
  type ItemActions,
  ItemRowProvider,
  type SelectModifiers,
} from "./items-list/item-row-context";
import { ItemsEmptyState } from "./items-list/items-empty-state";
import { ItemsSkeleton } from "./items-list/items-skeleton";
import {
  NavRegistryProvider,
  type ScrollToIdOptions,
  useNavRegistry,
} from "./items-list/list-nav-registry";
import { OpenTabsSection } from "./items-list/open-tabs-section";
import { PinnedSection } from "./items-list/pinned-section";
import { SearchBar } from "./items-list/search-bar";
import {
  clearSelection,
  pruneSelection,
  setSelection,
  useHasSelection,
} from "./items-list/selection-store";
import { ShortcutsDialog } from "./items-list/shortcuts-dialog";
import { SuggestedSection } from "./items-list/suggested-section";
import { TagFilters } from "./items-list/tag-filters";
import { Toolbar } from "./items-list/toolbar";
import { useAsk } from "./items-list/use-ask";
import { useBulkMutations } from "./items-list/use-bulk-mutations";
import { useCreateItem } from "./items-list/use-create-item";
import { useCursorItemActions } from "./items-list/use-cursor-item-actions";
import { useItemsFilters } from "./items-list/use-filters";
import { useKeyboardNavigation } from "./items-list/use-keyboard-navigation";
import { useListCursor } from "./items-list/use-list-cursor";
import { useListSearch } from "./items-list/use-list-search";
import { usePasteCreate } from "./items-list/use-paste-create";
import { useSelection } from "./items-list/use-selection";
import { useSuggestions } from "./items-list/use-suggestions";
import { useTypingTitles } from "./items-list/use-typing-titles";
import { VirtualItemList } from "./items-list/virtual-item-list";
import { VirtualScrollProvider } from "./items-list/virtual-scroll-context";

export const ItemsList = ({
  onOpenItem,
  onOpenItemExpanded,
}: {
  onOpenItem: (id: string) => void;
  onOpenItemExpanded: (id: string) => void;
}) => {
  // Data
  const {
    data: items,
    isLoading,
    isError: itemsError,
    isFetching: itemsFetching,
    refetch: refetchItems,
  } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  // UI state
  const { settings, setSetting } = useSettings();
  const density = settings.density;
  const [itemToDelete, setItemToDelete] = React.useState<Item | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  // Snapshot of the ids the bulk delete confirm is targeting; null = closed.
  const [bulkDeleteIds, setBulkDeleteIds] = React.useState<string[] | null>(
    null,
  );
  const [scrolled, setScrolled] = React.useState(false);
  const [pinnedOpen, setPinnedOpen] = React.useState(true);
  const [suggestedOpen, setSuggestedOpen] = React.useState(true);
  const [openTabsOpen, setOpenTabsOpen] = React.useState(true);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);

  // Search — all search state, URL sync, and local/backend passes live in the
  // hook; SearchBar is a controlled input reading/writing `searchQuery`.
  const {
    searchBarRef,
    searchQuery,
    setSearchQuery,
    isFetching: searchFetching,
    resultCount: searchResultCount,
    searchOrder,
    searchActive,
    searchPending,
    searchBackendPending,
    handleSearchOpen,
  } = useListSearch(items);

  // Agentic "Ask" search — LLM tool-calling over the reading list.
  const {
    askActive,
    isAsking,
    error: askError,
    steps: askSteps,
    summary: askSummary,
    resultIds: askResultIds,
    hasPresented: askHasPresented,
    runAsk,
    clearAsk,
  } = useAsk();

  // An Ask result is a snapshot of one query — like a normal search result, it
  // should vanish as soon as the query changes (typing) or the bar closes.
  // Routed through a ref so ordinary typing only clears when a result is showing.
  const askActiveRef = React.useRef(askActive);
  askActiveRef.current = askActive;
  const handleQueryChange = React.useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (askActiveRef.current) clearAsk();
    },
    [setSearchQuery, clearAsk],
  );

  // Per-row typewriter title animation (used after pasting a URL).
  const { typingTitles, animateTypingTitle } = useTypingTitles();

  // Shared scroll viewport for the list body. Provided to every virtualized
  // section through context so they window against it. Tracked as state (via a
  // callback ref) as well as a ref: virtualized sections key their measurement
  // on the node identity, so they need a re-render when it (re)mounts — a bare
  // ref wouldn't notify them and they'd measure against null after a remount.
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [scrollContainerEl, setScrollContainerEl] =
    React.useState<HTMLDivElement | null>(null);
  const setScrollContainer = React.useCallback(
    (node: HTMLDivElement | null) => {
      scrollContainerRef.current = node;
      setScrollContainerEl(node);
    },
    [],
  );
  // Each navigable section (pinned, flat list, every group) registers its rows
  // here, giving keyboard nav one ordered, scroll-aware view across them all —
  // without items-list needing to know which sections are mounted.
  const navRegistry = useNavRegistry();

  // Keyboard nav reads the cursor order and scrolls rows through the registry,
  // so it stays correct across the flat list, pinned section, and every group —
  // including rows scrolled out of a virtualized window.
  const getOrderedIds = React.useCallback(
    () => navRegistry.getOrderedIds(),
    [navRegistry],
  );
  const scrollToId = React.useCallback(
    (id: string, opts?: ScrollToIdOptions) => navRegistry.scrollToId(id, opts),
    [navRegistry],
  );

  // Cursor — imperative store + navigation helpers (see use-list-cursor.ts).
  const {
    cursorRef,
    setCursor,
    navigateCursor,
    jumpCursor,
    moveCursorOffIds,
    selectionForCursor,
  } = useListCursor({ getOrderedIds, scrollToId });

  // Hooks
  const {
    sortedItems,
    allTags,
    filteredItems,
    hiddenReadCount,
    openTabItems,
    pinnedItems,
    unpinnedItems,
    activeTags,
    setActiveTags,
    toggleTag,
    tagsOpen,
    setTagsOpen,
    showRead,
    setShowRead,
    groupBy,
    groups,
  } = useItemsFilters(items, searchOrder);

  const {
    handleToggleRead,
    handleDeleteSingle,
    handleTogglePin,
    handleToggleHiddenFromReview,
  } = useCursorItemActions({
    filteredItems,
    showRead,
    setCursor,
  });

  // Derived layout flags — computed here (rather than just before render)
  // because the keyboard-nav order depends on them.
  // Group rows by date/tag only outside of search — search results carry their
  // own relevance order, so we fall back to the flat list while searching.
  const useGroupedLayout = groupBy !== "none" && !searchActive;

  // "Suggested next reads" — top unread items by heuristic score. Computed over
  // the full item set, but only surfaced on the plain reading-list view: while
  // searching or filtering by tags the user has already narrowed intent, so the
  // strip would just be noise.
  const allSuggestions = useSuggestions(items);
  const suggestedItems = React.useMemo(
    () =>
      settings.showSuggestions && !searchActive && activeTags.size === 0
        ? allSuggestions
        : [],
    [settings.showSuggestions, searchActive, activeTags, allSuggestions],
  );

  // Reveal-item requests (cross-window "Open in list", OS deep links): move the
  // cursor onto the item and center it in the list. Deferred to the next frame
  // so a just-opened item has mounted / the virtualizer knows its index. No-op
  // if the item isn't in the current view (filtered out) — the registry simply
  // doesn't find it.
  React.useEffect(() => {
    return subscribeRevealItem((id) => {
      requestAnimationFrame(() => {
        setCursor(id);
        scrollToId(id, { center: true });
      });
    });
  }, [scrollToId, setCursor]);

  // Multi-select gestures (shift-click ranges, cmd-click toggles, shift+arrow
  // extension, select-all) over the same visual order keyboard nav uses.
  const { applyRowClick, extendSelection, selectAll } = useSelection({
    getOrderedIds,
    scrollToId,
    cursorRef,
    setCursor,
  });

  // Clicking a row moves the list cursor onto it; a plain click also opens it,
  // while cmd/shift clicks only change the selection. With `openOnSingleClick`
  // off, opening moves to the double-click below — but only for the *first*
  // open: once a preview is up, single clicks steer it, because a panel that
  // ignored the row you just clicked would be showing the wrong item.
  const openOnSingleClick = settings.openOnSingleClick;
  const handleSelectItem = React.useCallback(
    (id: string, modifiers?: SelectModifiers) => {
      const shouldOpen = applyRowClick(
        id,
        modifiers ?? { meta: false, shift: false },
      );
      if (!shouldOpen) return;
      setCursor(id);
      if (!openOnSingleClick) {
        setSelection([id], id);
        const openId = getOpenItemId();
        // Nothing open yet (double-click opens), or this row is already the
        // one on screen — either way the click is selection only.
        if (openId === null || openId === id) return;
      }
      onOpenItem(id);
    },
    [applyRowClick, setCursor, onOpenItem, openOnSingleClick],
  );

  // Double-click (and the suggested strip's cards): open regardless of the
  // setting, collapsing any selection the way a plain opening click does.
  const handleActivateItem = React.useCallback(
    (id: string) => {
      applyRowClick(id, { meta: false, shift: false });
      setCursor(id);
      onOpenItem(id);
    },
    [applyRowClick, setCursor, onOpenItem],
  );

  // Drop selected rows that are no longer visible — deleted (here or in
  // another window), filtered out by search/tags/read-visibility, or hidden
  // inside the collapsed pinned section — so bulk actions can never touch
  // rows the user can't see. Reads the registry so collapse state counts.
  React.useEffect(() => {
    pruneSelection(new Set(getOrderedIds()));
  }, [filteredItems, pinnedOpen, getOrderedIds]);

  // The selection is a dismiss-stack layer (lib/dismiss-stack.ts), active
  // whenever something is selected, so Escape clears it in LIFO order relative
  // to the panel/search — a selection made *after* opening the panel is cleared
  // first, and one made *before* loses to the panel by recency. Because the
  // layer intercepts Escape while a selection exists, the fallback below only
  // ever runs to clear the cursor.
  const hasSelection = useHasSelection();
  useDismissLayer({ active: hasSelection, onDismiss: clearSelection });

  // Escape's fall-through default once the selection layer (above) and every
  // other dismissible surface are gone: clear the list cursor.
  const handleEscapeFallback = React.useCallback(() => {
    setCursor(null);
  }, [setCursor]);

  // When the search filter narrows the list, pin the cursor to the first
  // visible result so Enter from the search input opens the top match.
  React.useEffect(() => {
    if (searchOrder === null) return;
    const current = cursorRef.current;
    if (current && filteredItems.some((i) => i.id === current)) return;
    setCursor(filteredItems[0]?.id ?? null);
  }, [searchOrder, filteredItems, cursorRef, setCursor]);

  const requestDeleteItem = React.useCallback(
    (id: string) => {
      const item = items?.find((i) => i.id === id) ?? null;
      if (!item) return;
      setItemToDelete(item);
      setDeleteOpen(true);
    },
    [items],
  );

  const confirmDelete = React.useCallback(() => {
    if (!itemToDelete) return;
    handleDeleteSingle(itemToDelete.id);
    setDeleteOpen(false);
  }, [itemToDelete, handleDeleteSingle]);

  // Bulk actions over the current selection. Mutations are optimistic (see
  // use-bulk-mutations); before rows vanish (delete, mark-read while read
  // items are hidden) the cursor hops to the nearest surviving row, and the
  // prune effect above drops the vanished ids from the selection.
  const { bulkReadMutation, bulkPinMutation, bulkDeleteMutation } =
    useBulkMutations();

  const handleBulkMarkRead = React.useCallback(
    (itemIds: string[], read: boolean) => {
      if (read && !showRead) moveCursorOffIds(itemIds);
      bulkReadMutation.mutate({ itemIds, read });
    },
    [showRead, moveCursorOffIds, bulkReadMutation],
  );

  const handleBulkSetPinned = React.useCallback(
    (itemIds: string[], starred: boolean) => {
      bulkPinMutation.mutate({ itemIds, starred });
    },
    [bulkPinMutation],
  );

  const requestBulkDelete = React.useCallback((itemIds: string[]) => {
    if (itemIds.length === 0) return;
    setBulkDeleteIds(itemIds);
  }, []);

  const confirmBulkDelete = React.useCallback(() => {
    if (!bulkDeleteIds) return;
    moveCursorOffIds(bulkDeleteIds);
    clearSelection();
    bulkDeleteMutation.mutate(bulkDeleteIds);
    setBulkDeleteIds(null);
  }, [bulkDeleteIds, moveCursorOffIds, bulkDeleteMutation]);

  const handleBulkDeleteOpenChange = React.useCallback((open: boolean) => {
    if (!open) setBulkDeleteIds(null);
  }, []);

  const bulkDeleteTargets = React.useMemo(
    () =>
      bulkDeleteIds
        ? (items ?? []).filter((item) => bulkDeleteIds.includes(item.id))
        : [],
    [bulkDeleteIds, items],
  );

  // Create
  const {
    requestCreate,
    isCreating,
    duplicateDialog,
    dismissDuplicateDialog,
    openExisting: handleDuplicateOpenExisting,
    createAnyway: handleDuplicateCreateAnyway,
  } = useCreateItem();

  // Blank-item and paste-a-URL creation flows (see use-paste-create.ts).
  const { handleOpenNew, requestPasteCreate, handlePasteUrl } = usePasteCreate({
    requestCreate,
    onOpenItem,
    animateTypingTitle,
    activeTags,
  });

  const handleToggleReadCursor = React.useCallback(() => {
    const id = cursorRef.current;
    if (!id) return;
    const selection = selectionForCursor();
    if (selection) {
      const selected = new Set(selection);
      const anyUnread = (items ?? []).some(
        (i) => selected.has(i.id) && !i.read,
      );
      handleBulkMarkRead(selection, anyUnread);
      return;
    }
    const item = items?.find((i) => i.id === id);
    if (!item) return;
    handleToggleRead(id, !item.read);
  }, [
    items,
    cursorRef,
    handleToggleRead,
    selectionForCursor,
    handleBulkMarkRead,
  ]);

  const handleTogglePinCursor = React.useCallback(() => {
    const id = cursorRef.current;
    if (!id) return;
    const selection = selectionForCursor();
    if (selection) {
      const selected = new Set(selection);
      const allPinned = (items ?? [])
        .filter((i) => selected.has(i.id))
        .every((i) => i.starred);
      handleBulkSetPinned(selection, !allPinned);
      return;
    }
    const item = items?.find((i) => i.id === id);
    if (!item) return;
    handleTogglePin(id, !item.starred);
  }, [
    items,
    cursorRef,
    handleTogglePin,
    selectionForCursor,
    handleBulkSetPinned,
  ]);

  const handleChatCursor = React.useCallback(() => {
    const id = cursorRef.current;
    if (!id) return;
    const item = items?.find((i) => i.id === id);
    if (item) openChatWithClaude(item);
  }, [items, cursorRef]);

  const handleToggleDensity = React.useCallback(() => {
    setSetting("density", density === "cozy" ? "compact" : "cozy");
  }, [setSetting, density]);

  // Flip between an explicit light/dark theme based on what's currently applied
  // to <html>. This collapses the 3-way setting (system/light/dark) to a direct
  // toggle — the settings menu still exposes "system" for those who want it.
  const handleToggleTheme = React.useCallback(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setSetting("theme", isDark ? "light" : "dark");
  }, [setSetting]);

  const { suppressHover, setSuppressHover } = useKeyboardNavigation({
    filteredItems,
    getOrderedIds,
    scrollToId,
    setTagsOpen,
    setShowRead,
    cursorRef,
    setCursor,
    onRequestDelete: React.useCallback(() => {
      const cursor = cursorRef.current;
      if (!cursor) return;
      const selection = selectionForCursor();
      if (selection) requestBulkDelete(selection);
      else requestDeleteItem(cursor);
    }, [cursorRef, requestDeleteItem, selectionForCursor, requestBulkDelete]),
    onExtendSelection: extendSelection,
    onSelectAll: selectAll,
    onEscapeFallback: handleEscapeFallback,
    activeTags,
    onOpenItem,
    onOpenItemExpanded,
    onOpenNew: handleOpenNew,
    onPasteCreate: requestPasteCreate,
    onSearchOpen: handleSearchOpen,
    onToggleReadCursor: handleToggleReadCursor,
    onTogglePinCursor: handleTogglePinCursor,
    onChatCursor: handleChatCursor,
    onToggleDensity: handleToggleDensity,
    onToggleTheme: handleToggleTheme,
    onShowShortcuts: React.useCallback(() => setShortcutsOpen(true), []),
  });

  // Effects
  React.useEffect(() => {
    const el = scrollContainerEl;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 0);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollContainerEl]);

  // Derived state
  // Empty state (see items-empty-state.tsx for the message derivation).
  const handleShowRead = React.useCallback(
    () => setShowRead(true),
    [setShowRead],
  );
  const emptyNode = (
    <ItemsEmptyState
      filteredCount={filteredItems.length}
      totalCount={sortedItems.length}
      hiddenReadCount={hiddenReadCount}
      searchActive={searchActive}
      searchQuery={searchQuery}
      searchBackendPending={searchBackendPending}
      onAdd={handleOpenNew}
      onShowRead={handleShowRead}
    />
  );

  // Error placeholder. When the items query errors, this replaces the entire
  // list body — error and content are mutually exclusive, never shown together
  // (React Query keeps stale `data` on a failed refetch, so we must not fall
  // through to rendering the cached list underneath the error).
  const handleRetryItems = React.useCallback(() => {
    refetchItems();
  }, [refetchItems]);

  const errorNode = (
    <NonIdealState
      align="center"
      size="sm"
      tone="error"
      className="py-6"
      title="Failed to load items"
      description="Check your connection and try again."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetryItems}
          disabled={itemsFetching}
        >
          {itemsFetching ? "Retrying…" : "Retry"}
        </Button>
      }
    />
  );

  // Row actions delivered to the list tree via context instead of drilled
  // through six layers of layout/virtualization primitives that never use them.
  const itemActions = React.useMemo<ItemActions>(
    () => ({
      onSelect: handleSelectItem,
      onActivate: handleActivateItem,
      onDelete: requestDeleteItem,
      onToggleRead: handleToggleRead,
      onTogglePin: handleTogglePin,
      onToggleHiddenFromReview: handleToggleHiddenFromReview,
      bulk: {
        markRead: handleBulkMarkRead,
        setPinned: handleBulkSetPinned,
        requestDelete: requestBulkDelete,
      },
    }),
    [
      handleSelectItem,
      handleActivateItem,
      requestDeleteItem,
      handleToggleRead,
      handleTogglePin,
      handleToggleHiddenFromReview,
      handleBulkMarkRead,
      handleBulkSetPinned,
      requestBulkDelete,
    ],
  );

  return (
    <VirtualScrollProvider
      scrollRef={scrollContainerRef}
      scrollElement={scrollContainerEl}
    >
      <NavRegistryProvider registry={navRegistry}>
        <div className="electron-toolbar-container relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Header — outside the scroll container so the scrollbar starts
          below it instead of reaching all the way to the top of the panel. */}
          <div className="relative z-10 mx-auto flex w-full max-w-175 flex-col gap-3 bg-background pb-3">
            <div className="electron-top-bar-inset">
              <Toolbar
                hasTags={allTags.length > 0}
                onAdd={handleOpenNew}
                onPasteUrl={handlePasteUrl}
                isCreating={isCreating}
              />
            </div>

            <SearchBar
              ref={searchBarRef}
              query={searchQuery}
              onQueryChange={handleQueryChange}
              resultCount={searchResultCount}
              isFetching={searchFetching}
              onAsk={runAsk}
              isAsking={isAsking}
              onCursorNav={navigateCursor}
              onCursorJump={jumpCursor}
              onCursorOpen={({ meta, shift }) => {
                const id = cursorRef.current;
                if (!id) return;
                if (meta && shift) {
                  const item = items?.find((i) => i.id === id);
                  if (item?.url && URL.canParse(item.url))
                    window.open(item.url, "_blank");
                  return;
                }
                if (meta) {
                  onOpenItemExpanded(id);
                  return;
                }
                onOpenItem(id);
              }}
              placeholder="Search items"
            />

            {tagsOpen && allTags.length > 0 && (
              <TagFilters
                allTags={allTags}
                activeTags={activeTags}
                items={sortedItems}
                toggleTag={toggleTag}
                setActiveTags={setActiveTags}
              />
            )}

            <div
              className={cn(
                "pointer-events-none absolute right-0 bottom-0 left-0 h-8 translate-y-full bg-linear-to-b from-background to-transparent transition-opacity duration-200",
                scrolled ? "opacity-100" : "opacity-0",
              )}
            />
          </div>

          {/* Scrollable content */}
          <div
            ref={setScrollContainer}
            className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
          >
            <div className="mx-auto flex max-w-175 flex-col gap-3 pb-5">
              <LoadingFade
                loading={isLoading || searchPending}
                skeleton={<ItemsSkeleton density={density} />}
              >
                {itemsError ? (
                  errorNode
                ) : (
                  <ItemRowProvider
                    actions={itemActions}
                    suppressHover={suppressHover}
                    typingTitles={typingTitles}
                  >
                    <div
                      onMouseMove={
                        suppressHover
                          ? () => setSuppressHover(false)
                          : undefined
                      }
                    >
                      {askActive ? (
                        <AskResults
                          summary={askSummary}
                          steps={askSteps}
                          resultIds={askResultIds}
                          isAsking={isAsking}
                          hasPresented={askHasPresented}
                          error={askError}
                          items={items ?? []}
                        />
                      ) : (
                        <>
                          {emptyNode}

                          <SuggestedSection
                            items={suggestedItems}
                            open={suggestedOpen}
                            onToggleOpen={() => setSuggestedOpen((p) => !p)}
                            onHide={() => setSetting("showSuggestions", false)}
                          />

                          <OpenTabsSection
                            items={openTabItems}
                            open={openTabsOpen}
                            onToggleOpen={() => setOpenTabsOpen((p) => !p)}
                          />

                          <PinnedSection
                            items={pinnedItems}
                            open={pinnedOpen}
                            onToggleOpen={() => setPinnedOpen((p) => !p)}
                          />

                          {useGroupedLayout ? (
                            <GroupedList groups={groups} items={items ?? []} />
                          ) : (
                            <>
                              <VirtualItemList items={unpinnedItems} />
                              {/* Backend (trigram) pass still running: append
                              loading rows under the instant keyword hits so the
                              search reads as "more coming," not finished. */}
                              {searchActive && searchBackendPending && (
                                <ItemsSkeleton density={density} />
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </ItemRowProvider>
                )}
              </LoadingFade>
            </div>
          </div>

          {/* Bottom-of-list fade — softens the boundary where the list ends, so
          items don't get sliced in half by the item panel's top edge in
          side orientation. Hidden in narrow (vertical split) mode where the
          panel butts directly against the list. */}
          <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-10 hidden h-8 bg-linear-to-t from-background to-transparent md:block" />

          <DeleteItemsDialog
            item={itemToDelete}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onConfirm={confirmDelete}
          />

          <DeleteItemsDialog
            items={bulkDeleteTargets}
            open={bulkDeleteIds !== null}
            onOpenChange={handleBulkDeleteOpenChange}
            onConfirm={confirmBulkDelete}
          />

          <DuplicateDialog
            open={duplicateDialog !== null}
            onOpenChange={dismissDuplicateDialog}
            existing={duplicateDialog?.existing ?? null}
            onOpenExisting={handleDuplicateOpenExisting}
            onCreateAnyway={handleDuplicateCreateAnyway}
          />

          <ShortcutsDialog
            open={shortcutsOpen}
            onOpenChange={setShortcutsOpen}
          />
        </div>
      </NavRegistryProvider>
    </VirtualScrollProvider>
  );
};
