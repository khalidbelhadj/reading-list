"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DeleteItemDialog } from "./items-list/delete-item-dialog";
import { makeOptimisticItem } from "./items-list/utils";

import { fetchPageTitle, searchFlashcards, searchItems } from "@/app/actions";
import { LoadingFade } from "@/components/ui/loading-fade";
import { fetchItems } from "@/lib/queries";
import { openChatWithClaude } from "@/lib/chat-with-claude";
import { useSettings } from "@/lib/use-settings";
import { CardsList, CardsStateBar } from "./items-list/cards-list";
import { setCursorId } from "./items-list/cursor-store";
import { DuplicateDialog } from "./items-list/duplicate-dialog";
import { GroupedList } from "./items-list/grouped-list";
import { ItemList } from "./items-list/item-list";
import { ItemsSkeleton } from "./items-list/items-skeleton";
import { PinnedSection } from "./items-list/pinned-section";
import { ReviewNudge } from "./items-list/review-nudge";
import { SearchBar } from "./items-list/search-bar";
import { ShortcutsDialog } from "./items-list/shortcuts-dialog";
import { SuggestedSection } from "./items-list/suggested-section";
import { TagFilters } from "./items-list/tag-filters";
import { Toolbar } from "./items-list/toolbar";
import { useCreateItem } from "./items-list/use-create-item";
import { useItemsFilters, type TabId } from "./items-list/use-filters";
import { useInvalidateItems } from "./items-list/use-invalidate-items";
import { useKeyboardNavigation } from "./items-list/use-keyboard-navigation";
import { useListSearch } from "./items-list/use-list-search";
import { useSuggestions } from "./items-list/use-suggestions";
import { useItemsMutations } from "./items-list/use-mutations";
import { useTypingTitles } from "./items-list/use-typing-titles";

export const ItemsList = ({
  onOpenItem,
  onOpenItemExpanded,
}: {
  onOpenItem: (id: string) => void;
  onOpenItemExpanded: (id: string) => void;
}) => {
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
  const { settings, setSetting } = useSettings();
  const density = settings.density;
  const [itemToDelete, setItemToDelete] = React.useState<Item | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [pinnedOpen, setPinnedOpen] = React.useState(true);
  const [suggestedOpen, setSuggestedOpen] = React.useState(true);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  // URL ?tab= wins; otherwise fall back to the user's last-used tab from
  // settings. Local state because the URL still drives intra-session tab
  // changes — settings just remembers the default across reloads.
  const [activeTab, setActiveTab] = React.useState<TabId>(() => {
    const tab = searchParams.get("tab");
    if (tab === "cards") return "cards";
    if (tab === "reading-list") return "reading-list";
    return settings.activeTab;
  });

  // Search — all search state, URL sync, and local/backend passes live here.
  const {
    searchBarRef,
    searchOrder,
    searchActive,
    searchPending,
    searchBackendPending,
    initialSearchQuery,
    localSearchItems,
    localSearchFlashcards,
    handleSearchResults,
    handleSearchQueryChange,
    handleSearchPendingChange,
    handleSearchBackendPendingChange,
    handleSearchOpen,
  } = useListSearch(items);

  // Per-row typewriter title animation (used after pasting a URL).
  const { typingTitles, animateTypingTitle } = useTypingTitles();

  // Cursor — driven through an imperative store so only the previously-active
  // and newly-active rows re-render on each move. Keeping a ref mirror lets
  // event handlers read the current id without stale closures.
  const cursorRef = React.useRef<string | null>(null);
  const setCursor = React.useCallback((id: string | null) => {
    cursorRef.current = id;
    setCursorId(id);
  }, []);

  // Helpers
  const invalidate = useInvalidateItems();

  const setActiveTabAndUrl = React.useCallback(
    (tab: TabId) => {
      setActiveTab(tab);
      setSetting("activeTab", tab);
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
    },
    [setSetting],
  );

  const handleOpenItem = onOpenItem;

  // Hooks
  const {
    tabItems,
    allTags,
    filteredItems,
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
  } = useItemsFilters(items, activeTab, searchOrder);

  const { handleToggleRead, handleDeleteSingle, handleTogglePin } =
    useItemsMutations({
      filteredItems,
      showRead,
      setCursor,
    });

  // Cursor navigation driven from inside the search input — arrows / Ctrl+N/P
  // move the cursor without unfocusing, so Enter opens the highlighted item.
  const navigateCursor = React.useCallback(
    (direction: "next" | "prev") => {
      // Read the live render order from the DOM so nav matches what's visible
      // — grouped, pinned, and collapsed sections all reshuffle relative to
      // filteredItems (which is in raw creation-date order).
      const ids = Array.from(
        document.querySelectorAll<HTMLElement>("[data-item-id]"),
      )
        .map((el) => el.dataset.itemId)
        .filter((id): id is string => !!id);
      if (ids.length === 0) return;
      const current = cursorRef.current;
      const idx = current ? ids.indexOf(current) : -1;
      // No cursor yet — start from the row the mouse is hovering over so the
      // first arrow press picks it up instead of jumping to the list edge.
      if (idx === -1) {
        const hovered = document.querySelector<HTMLElement>(
          "[data-item-id]:hover",
        );
        const hoveredId = hovered?.dataset.itemId;
        if (hoveredId) {
          const hoveredIdx = ids.indexOf(hoveredId);
          if (hoveredIdx !== -1) {
            setCursor(hoveredId);
            hovered?.scrollIntoView({ block: "nearest" });
            return;
          }
        }
      }
      const nextId =
        idx === -1
          ? direction === "next"
            ? ids[0]
            : ids[ids.length - 1]
          : direction === "next"
            ? ids[Math.min(idx + 1, ids.length - 1)]
            : ids[Math.max(idx - 1, 0)];
      setCursor(nextId);
      const el = document.querySelector(`[data-item-id="${nextId}"]`);
      el?.scrollIntoView({ block: "nearest" });
    },
    [setCursor],
  );
  // When the search filter narrows the list, pin the cursor to the first
  // visible result so Enter from the search input opens the top match.
  React.useEffect(() => {
    if (searchOrder === null) return;
    const current = cursorRef.current;
    if (current && filteredItems.some((i) => i.id === current)) return;
    setCursor(filteredItems[0]?.id ?? null);
  }, [searchOrder, filteredItems, setCursor]);

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

  // Create
  const {
    requestCreate,
    isCreating,
    duplicateDialog,
    dismissDuplicateDialog,
    openExisting: handleDuplicateOpenExisting,
    createAnyway: handleDuplicateCreateAnyway,
  } = useCreateItem();

  const [isFetchingPasteTitle, setIsFetchingPasteTitle] = React.useState(false);

  const handleOpenNew = React.useCallback(() => {
    requestCreate(
      { title: "", url: "", tagNames: [] },
      {
        onCreated: (newId) => {
          // Optimistically insert into the cache so the detail page can
          // render the new (empty) item without waiting on a full refetch.
          queryClient.setQueryData<Item[]>(["items"], (old) => {
            if (!old) return old;
            return [makeOptimisticItem(newId, old), ...old];
          });
          invalidate();
          handleOpenItem(newId);
        },
        onError: () => {
          toast.error("Could not create item", {
            description: "Please try again.",
          });
        },
      },
    );
  }, [requestCreate, queryClient, invalidate, handleOpenItem]);

  const requestPasteCreate = React.useCallback(
    async (url: string, tagNames: string[]) => {
      setIsFetchingPasteTitle(true);
      let fetched: string | null = null;
      try {
        fetched = await fetchPageTitle(url);
      } finally {
        setIsFetchingPasteTitle(false);
      }
      const fallback = (() => {
        try {
          return new URL(url).hostname.replace(/^www\./, "");
        } catch {
          return url;
        }
      })();
      const title = fetched?.trim() || fallback;
      requestCreate(
        { title, url, tagNames },
        {
          onCreated: (newId) => {
            // Optimistically insert so the row appears immediately; the
            // animation typing overlay then replaces its title visually.
            queryClient.setQueryData<Item[]>(["items"], (old) => {
              if (!old) return old;
              if (old.some((it) => it.id === newId)) return old;
              return [
                makeOptimisticItem(newId, old, { title, url, tagNames }),
                ...old,
              ];
            });
            invalidate();
            void animateTypingTitle(newId, title);
          },
          onOpenExisting: handleOpenItem,
        },
      );
    },
    [requestCreate, handleOpenItem, invalidate, animateTypingTitle, queryClient],
  );

  const handlePasteUrl = React.useCallback(async () => {
    // The dropdown menu's focus handoff hasn't settled by the time this
    // handler runs synchronously — clipboard.readText() would reject with
    // "Document is not focused". Wait one frame for focus to return to the
    // trigger, then read.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    let text: string;
    try {
      text = (await navigator.clipboard.readText()).trim();
    } catch {
      toast.error("Couldn't read clipboard", {
        description: "Grant clipboard permission and try again.",
      });
      return;
    }
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      toast.error("Invalid URL", {
        description: "Your clipboard doesn't contain a valid URL.",
      });
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      toast.error("Invalid URL", {
        description: "Your clipboard doesn't contain a valid URL.",
      });
      return;
    }
    requestPasteCreate(text, [...activeTags]);
  }, [requestPasteCreate, activeTags]);

  const handleToggleReadCursor = React.useCallback(() => {
    const id = cursorRef.current;
    if (!id) return;
    const item = items?.find((i) => i.id === id);
    if (!item) return;
    handleToggleRead(id, !item.read);
  }, [items, handleToggleRead]);

  const handleTogglePinCursor = React.useCallback(() => {
    const id = cursorRef.current;
    if (!id) return;
    const item = items?.find((i) => i.id === id);
    if (!item) return;
    handleTogglePin(id, !item.starred);
  }, [items, handleTogglePin]);

  const handleChatCursor = React.useCallback(() => {
    const id = cursorRef.current;
    if (!id) return;
    const item = items?.find((i) => i.id === id);
    if (item) openChatWithClaude(item);
  }, [items]);

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
    setActiveTabAndUrl,
    setTagsOpen,
    setShowRead,
    cursorRef,
    setCursor,
    onRequestDelete: React.useCallback(() => {
      const cursor = cursorRef.current;
      if (cursor) requestDeleteItem(cursor);
    }, [requestDeleteItem]),
    activeTags,
    onOpenItem: handleOpenItem,
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
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 0);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Derived state
  // Group rows by date/tag only outside of search — search results carry their
  // own relevance order, so we fall back to the flat list while searching.
  const useGroupedLayout = groupBy !== "none" && !searchActive;

  // "Suggested next reads" — top unread items by heuristic score. Computed over
  // the full item set, but only surfaced on the plain reading-list view: while
  // searching or filtering by tags the user has already narrowed intent, so the
  // strip would just be noise.
  const allSuggestions = useSuggestions(items);
  const suggestedItems =
    activeTab !== "cards" && !searchActive && activeTags.size === 0
      ? allSuggestions
      : [];

  // Empty state message
  const emptyState = React.useMemo(() => {
    if (filteredItems.length > 0) return null;
    if (tabItems.length === 0)
      return { message: "Nothing here yet", hasHiddenRead: false };

    const searchSet = searchOrder ? new Set(searchOrder) : null;
    const hiddenReadCount = !showRead
      ? tabItems.filter(
          (item) =>
            item.read &&
            (searchSet === null || searchSet.has(item.id)) &&
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
  }, [filteredItems, tabItems, showRead, activeTags, searchOrder]);

  // Hold the "no matches" message while the backend search is still resolving —
  // otherwise a query with no local keyword hits flashes "no results" before the
  // trigram pass gets a chance to return any. The skeletons cover that window.
  const emptyNode = emptyState && !searchBackendPending && (
    <div className="px-1 py-6 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
      <span>{emptyState.message}</span>
      {emptyState.hasHiddenRead && (
        <Button variant="outline" size="sm" onClick={() => setShowRead(true)}>
          Show read
        </Button>
      )}
    </div>
  );

  // Error / empty placeholder shown at the top of the list body.
  const statusNode = itemsError ? (
    <div className="px-1 py-6 text-center text-destructive text-xs">
      Failed to load items
    </div>
  ) : (
    emptyNode
  );

  return (
    <div className="electron-toolbar-container relative flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      {/* Header — outside the scroll container so the scrollbar starts
          below it instead of reaching all the way to the top of the panel. */}
      <div className="relative z-10 mx-auto max-w-175 w-full flex flex-col gap-3 pb-3 bg-background">
        <div className="electron-top-bar-inset">
          <Toolbar
            activeTab={activeTab}
            setActiveTabAndUrl={setActiveTabAndUrl}
            hasTags={allTags.length > 0}
            onAdd={handleOpenNew}
            onPasteUrl={handlePasteUrl}
            isCreating={isCreating || isFetchingPasteTitle}
          />
        </div>

        <SearchBar
          ref={searchBarRef}
          queryKey={
            activeTab === "cards"
              ? ["all-flashcards", "search"]
              : ["items", "search"]
          }
          searchFn={activeTab === "cards" ? searchFlashcards : searchItems}
          localSearchFn={
            activeTab === "cards" ? localSearchFlashcards : localSearchItems
          }
          onCursorNav={navigateCursor}
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
            handleOpenItem(id);
          }}
          onResults={handleSearchResults}
          onQueryChange={handleSearchQueryChange}
          onPendingChange={handleSearchPendingChange}
          onBackendPendingChange={handleSearchBackendPendingChange}
          initialQuery={initialSearchQuery}
          placeholder={activeTab === "cards" ? "Search cards" : "Search items"}
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

        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 h-8 bg-linear-to-b from-background to-transparent translate-y-full pointer-events-none transition-opacity duration-200",
            scrolled ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden"
      >
        <div className="mx-auto max-w-175 pb-5 flex flex-col gap-3">
          {activeTab === "cards" ? (
            <CardsList
              searchIds={searchOrder ? new Set(searchOrder) : null}
              searchPending={searchPending}
              onOpenItem={handleOpenItem}
            />
          ) : (
            <LoadingFade
              loading={isLoading || searchPending}
              skeleton={<ItemsSkeleton density={density} />}
            >
              <div
                onMouseMove={
                  suppressHover ? () => setSuppressHover(false) : undefined
                }
              >
                {statusNode}

                <SuggestedSection
                  items={suggestedItems}
                  open={suggestedOpen}
                  onToggleOpen={() => setSuggestedOpen((p) => !p)}
                  onSelect={handleOpenItem}
                  onDelete={requestDeleteItem}
                  onToggleRead={handleToggleRead}
                  onTogglePin={handleTogglePin}
                />

                <PinnedSection
                  items={pinnedItems}
                  open={pinnedOpen}
                  onToggleOpen={() => setPinnedOpen((p) => !p)}
                  typingTitles={typingTitles}
                  suppressHover={suppressHover}
                  density={density}
                  onSelect={handleOpenItem}
                  onDelete={requestDeleteItem}
                  onToggleRead={handleToggleRead}
                  onTogglePin={handleTogglePin}
                />

                {useGroupedLayout ? (
                  <GroupedList
                    groups={groups}
                    items={items ?? []}
                    typingTitles={typingTitles}
                    suppressHover={suppressHover}
                    density={density}
                    onSelect={handleOpenItem}
                    onDelete={requestDeleteItem}
                    onToggleRead={handleToggleRead}
                    onTogglePin={handleTogglePin}
                  />
                ) : (
                  <>
                    <ItemList
                      items={unpinnedItems}
                      typingTitles={typingTitles}
                      suppressHover={suppressHover}
                      density={density}
                      onSelect={handleOpenItem}
                      onDelete={requestDeleteItem}
                      onToggleRead={handleToggleRead}
                      onTogglePin={handleTogglePin}
                    />
                    {/* Backend (trigram) pass still running: append loading rows
                        under the instant keyword hits so the search reads as
                        "more coming," not finished. */}
                    {searchActive && searchBackendPending && (
                      <ItemsSkeleton density={density} />
                    )}
                  </>
                )}
              </div>
            </LoadingFade>
          )}
        </div>
      </div>

      {/* Bottom-of-list fade — softens the boundary where the list ends, so
          items don't get sliced in half by the item panel's top edge in
          side orientation. Hidden in narrow (vertical split) mode where the
          panel butts directly against the list. */}
      <div className="hidden md:block absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-background to-transparent pointer-events-none z-10" />

      <DeleteItemDialog
        item={itemToDelete}
        open={deleteOpen}
        deleting={false}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
      />

      <DuplicateDialog
        open={duplicateDialog !== null}
        onOpenChange={dismissDuplicateDialog}
        existing={duplicateDialog?.existing ?? null}
        onOpenExisting={handleDuplicateOpenExisting}
        onCreateAnyway={handleDuplicateCreateAnyway}
      />

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
};
