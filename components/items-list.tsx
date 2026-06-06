"use client";

import { IconChevronRight, IconPinFilled } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DeleteItemDialog } from "./items-list/delete-item-dialog";
import { resolveRowItem } from "./items-list/utils";

import { fetchPageTitle, searchFlashcards, searchItems } from "@/app/actions";
import { LoadingFade } from "@/components/ui/loading-fade";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchItems } from "@/lib/queries";
import { useSettings } from "@/lib/use-settings";
import { CardsList, CardsStateBar } from "./items-list/cards-list";
import { setCursorId } from "./items-list/cursor-store";
import { DuplicateDialog } from "./items-list/duplicate-dialog";
import {
  CollapsibleSection,
  GroupedList,
  PlainItemRow,
} from "./items-list/grouped-list";
import { ReviewNudge } from "./items-list/review-nudge";
import { SearchBar, type SearchBarHandle } from "./items-list/search-bar";
import { ItemRow } from "./items-list/item-row";
import { TagFilters } from "./items-list/tag-filters";
import { Toolbar } from "./items-list/toolbar";
import { useCreateItem } from "./items-list/use-create-item";
import { useItemsFilters, type TabId } from "./items-list/use-filters";
import { useInvalidateItems } from "./items-list/use-invalidate-items";
import { useKeyboardNavigation } from "./items-list/use-keyboard-navigation";
import { useItemsMutations } from "./items-list/use-mutations";

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
    staleTime: Infinity,
  });

  // UI state
  const searchParams = useSearchParams();
  const { settings, setSetting } = useSettings();
  const density = settings.density;
  const [itemToDelete, setItemToDelete] = React.useState<Item | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [pinnedOpen, setPinnedOpen] = React.useState(true);
  const [typingTitles, setTypingTitles] = React.useState<
    Record<string, string>
  >({});
  // URL ?tab= wins; otherwise fall back to the user's last-used tab from
  // settings. Local state because the URL still drives intra-session tab
  // changes — settings just remembers the default across reloads.
  const [activeTab, setActiveTab] = React.useState<TabId>(() => {
    const tab = searchParams.get("tab");
    if (tab === "cards") return "cards";
    if (tab === "reading-list") return "reading-list";
    return settings.activeTab;
  });

  // Search — query persisted in the URL as ?q=... so it survives navigation
  // away and back (e.g. clicking a result and hitting back). Captured once on
  // mount; subsequent URL changes go through replaceState below.
  const [initialSearchQuery] = React.useState(
    () => searchParams.get("q") ?? "",
  );
  const [searchOrder, setSearchOrder] = React.useState<string[] | null>(null);
  const [searchPending, setSearchPending] = React.useState(
    () => initialSearchQuery.length > 0,
  );
  const searchBarRef = React.useRef<SearchBarHandle | null>(null);
  const handleSearchResults = React.useCallback((ids: string[] | null) => {
    setSearchOrder(ids);
  }, []);
  const searchActive = searchOrder !== null;
  const handleSearchPendingChange = React.useCallback((pending: boolean) => {
    setSearchPending(pending);
  }, []);
  const handleSearchQueryChange = React.useCallback((query: string) => {
    const params = new URLSearchParams(window.location.search);
    const existing = params.get("q") ?? "";
    if (existing === query) return;
    if (query.length === 0) {
      params.delete("q");
    } else {
      params.set("q", query);
    }
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `?${queryString}` : window.location.pathname,
    );
  }, []);
  const handleSearchOpen = React.useCallback(() => {
    searchBarRef.current?.open();
  }, []);

  // Synchronous local search against the in-memory cache. Runs on every
  // keystroke so the list narrows instantly while the deeper server query
  // (trigram fuzzy on notes/flashcard text) is still in flight.
  const localSearchItems = React.useCallback(
    (query: string) => {
      if (!items) return [];
      const needle = query.toLowerCase();
      const matches: string[] = [];
      for (const item of items) {
        if (
          item.title.toLowerCase().includes(needle) ||
          item.url.toLowerCase().includes(needle)
        ) {
          matches.push(item.id);
        }
      }
      return matches;
    },
    [items],
  );
  const localSearchFlashcards = React.useCallback(
    (query: string) => {
      const cards = queryClient.getQueryData<
        Array<{ id: string; front: string; back: string }>
      >(["all-flashcards"]);
      if (!cards) return [];
      const needle = query.toLowerCase();
      const matches: string[] = [];
      for (const card of cards) {
        if (
          card.front.toLowerCase().includes(needle) ||
          card.back.toLowerCase().includes(needle)
        ) {
          matches.push(card.id);
        }
      }
      return matches;
    },
    [queryClient],
  );

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
            const now = new Date().toISOString();
            const userId = old[0]?.userId ?? "";
            const newItem: Item = {
              id: newId,
              userId,
              title: "",
              url: "",
              faviconUrl: null,
              previewImageUrl: null,
              starred: false,
              notes: null,
              read: false,
              readAt: null,
              createdAt: now,
              updatedAt: now,
              tags: [],
              flashcardCount: 0,
            };
            return [newItem, ...old];
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
              const now = new Date().toISOString();
              const userId = old[0]?.userId ?? "";
              const newItem: Item = {
                id: newId,
                userId,
                title,
                url,
                faviconUrl: null,
                previewImageUrl: null,
                starred: false,
                notes: null,
                read: false,
                readAt: null,
                createdAt: now,
                updatedAt: now,
                tags: tagNames.map((name, i) => ({
                  id: -(i + 1),
                  userId,
                  name,
                })),
                flashcardCount: 0,
              };
              return [newItem, ...old];
            });
            invalidate();
            void animateTypingTitle(newId, title);
          },
          onOpenExisting: handleOpenItem,
        },
      );
    },
    [
      requestCreate,
      handleOpenItem,
      invalidate,
      animateTypingTitle,
      queryClient,
    ],
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

  const emptyNode = emptyState && (
    <div className="px-1 py-6 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
      <span>{emptyState.message}</span>
      {emptyState.hasHiddenRead && (
        <Button variant="outline" size="sm" onClick={() => setShowRead(true)}>
          Show read
        </Button>
      )}
    </div>
  );

  return (
    <div className="electron-toolbar-container relative flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      {/* Header — outside the scroll container so the scrollbar starts
          below it instead of reaching all the way to the top of the panel. */}
      <div className="relative z-10 mx-auto max-w-175 w-full flex flex-col gap-3 pb-1 bg-background">
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
          {/* Content */}
          {activeTab === "cards" ? (
            <CardsList
              searchIds={searchOrder ? new Set(searchOrder) : null}
              searchPending={searchPending}
              onOpenItem={handleOpenItem}
            />
          ) : (
            <LoadingFade
              loading={isLoading || searchPending}
              skeleton={
                <div className="flex flex-col">
                  {Array.from({ length: 15 }).map((_, i) => {
                    // One width sequence drives both densities so the rhythm down
                    // the list reads the same, and the url bar in cozy mode is
                    // derived from the same row width so each row looks coherent.
                    const titleWidths = [24, 18, 30, 14, 22, 28, 16, 26];
                    const titleRem = titleWidths[i % titleWidths.length];
                    const urlRem = titleRem * 0.55;
                    const opacity = Math.max(1 - i * 0.07, 0.1);
                    if (density === "cozy") {
                      return (
                        <div
                          key={i}
                          style={{ opacity }}
                          className="flex items-stretch gap-3 p-2"
                        >
                          <Skeleton className="aspect-video w-32 shrink-0 rounded-md" />
                          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                            <Skeleton
                              className="h-3.5 rounded-md"
                              style={{ width: `min(${titleRem}rem, 85%)` }}
                            />
                            <Skeleton
                              className="h-3 rounded-md"
                              style={{ width: `min(${urlRem}rem, 60%)` }}
                            />
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={i}
                        style={{ opacity }}
                        className="flex items-center gap-2 p-1 h-7"
                      >
                        <Skeleton className="size-4 rounded-[3px] shrink-0" />
                        <Skeleton
                          className="h-3 rounded-md"
                          style={{ width: `min(${titleRem}rem, 85%)` }}
                        />
                      </div>
                    );
                  })}
                </div>
              }
            >
              {groupBy !== "none" && !searchActive ? (
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
                  {pinnedItems.length > 0 && (
                    <div className="flex flex-col mb-4">
                      <button
                        type="button"
                        onClick={() => setPinnedOpen((p) => !p)}
                        className="inline-flex items-center gap-1 px-1 pb-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors outline-none select-none"
                      >
                        <IconPinFilled className="size-3" />
                        Pinned
                        <IconChevronRight
                          className={cn(
                            "size-3 transition-transform duration-150",
                            pinnedOpen && "rotate-90",
                          )}
                        />
                      </button>
                      <CollapsibleSection open={pinnedOpen}>
                        {pinnedItems.map((item) => {
                          const typingTitle = typingTitles[item.id];
                          const rowItem = resolveRowItem(item, typingTitle);
                          return (
                            <PlainItemRow
                              key={item.id}
                              item={rowItem}
                              suppressHover={suppressHover}
                              density={density}
                              isTyping={typingTitle !== undefined}
                              onSelect={() => handleOpenItem(item.id)}
                              onDelete={() => requestDeleteItem(item.id)}
                              onToggleRead={() =>
                                handleToggleRead(item.id, !item.read)
                              }
                              onTogglePin={() =>
                                handleTogglePin(item.id, !item.starred)
                              }
                            />
                          );
                        })}
                      </CollapsibleSection>
                    </div>
                  )}
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
                </div>
              ) : (
                <div
                  onMouseMove={
                    suppressHover
                      ? () => setSuppressHover(false)
                      : undefined
                  }
                >
                  {itemsError ? (
                    <div className="px-1 py-6 text-center text-destructive text-xs">
                      Failed to load items
                    </div>
                  ) : (
                    emptyNode
                  )}
                  {pinnedItems.length > 0 && (
                    <div className="flex flex-col mb-4">
                      <button
                        type="button"
                        onClick={() => setPinnedOpen((p) => !p)}
                        className="inline-flex items-center gap-1 px-1 pb-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors outline-none select-none"
                      >
                        <IconPinFilled className="size-3" />
                        Pinned
                        <IconChevronRight
                          className={cn(
                            "size-3 transition-transform duration-150",
                            pinnedOpen && "rotate-90",
                          )}
                        />
                      </button>
                      <CollapsibleSection open={pinnedOpen}>
                        {pinnedItems.map((item) => {
                          const typingTitle = typingTitles[item.id];
                          const rowItem = resolveRowItem(item, typingTitle);
                          return (
                            <ItemRow
                              key={item.id}
                              item={rowItem}
                              suppressHover={suppressHover}
                              density={density}
                              isTyping={typingTitle !== undefined}
                              onTogglePin={() =>
                                handleTogglePin(item.id, !item.starred)
                              }
                              onToggleRead={() =>
                                handleToggleRead(item.id, !item.read)
                              }
                              onSelect={() => handleOpenItem(item.id)}
                              onDelete={() => requestDeleteItem(item.id)}
                            />
                          );
                        })}
                      </CollapsibleSection>
                    </div>
                  )}
                  {unpinnedItems.map((item) => {
                    const typingTitle = typingTitles[item.id];
                    const rowItem = resolveRowItem(item, typingTitle);
                    return (
                      <ItemRow
                        key={item.id}
                        item={rowItem}
                        suppressHover={suppressHover}
                        density={density}
                        isTyping={typingTitle !== undefined}
                        onTogglePin={() =>
                          handleTogglePin(item.id, !item.starred)
                        }
                        onToggleRead={() =>
                          handleToggleRead(item.id, !item.read)
                        }
                        onSelect={() => handleOpenItem(item.id)}
                        onDelete={() => requestDeleteItem(item.id)}
                      />
                    );
                  })}
                </div>
              )}
            </LoadingFade>
          )}
        </div>
      </div>

      {/* Bottom-of-list fade — softens the boundary where the list ends, so
          items don't get sliced in half by the item panel's top edge in
          bottom orientation. */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-background to-transparent pointer-events-none z-10" />

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
    </div>
  );
};
