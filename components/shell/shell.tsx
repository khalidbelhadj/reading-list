import { IconLayoutSidebar } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { getAllFlashcards } from "@/app/actions";
import { fetchItems } from "@/app/actions";
import { Button } from "@/components/system/button";
import { Tooltip } from "@/components/system/tooltip";
import { type Item } from "@/lib/types";
import { useWindowVibrancy } from "@/lib/use-window-vibrancy";

import { AllItems } from "./all-items";
import { AppSidebar } from "./app-sidebar";
import { ItemPalette } from "./command-palette";
import { ItemView, ItemViewActions } from "./item-view";
import { ReviewPane } from "./review-pane";
import { clipboardUrl, useCreateItem } from "./use-create-item";
import { VersionPane } from "./version-pane";
import { publishDevView, useViewCommands, type View } from "./view";

// Paste targets that should keep their native paste (the search input, the
// editor, an editable title) instead of triggering create-from-URL.
const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.closest("input, textarea, [contenteditable]") !== null ||
    target.isContentEditable);

// readinglist://item/<id> deep links (the extension's "open in app", and
// links in shared notes). Electron forwards them via the preload bridge;
// no-op on web.
const useDeepLinkedItem = (openItem: (id: string) => void) => {
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.readingList) return;
    return window.readingList.onDeepLink((url) => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return;
      }
      if (parsed.hostname !== "item") return;
      const id = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
      if (id) openItem(id);
    });
  }, [openItem]);
};

// The pane is one shared scroll container, so a view change would reset the
// Reading list's position. Remember it while the list is showing and put it
// back on return; every other view starts at the top.
const usePaneScrollMemory = (view: View) => {
  const mainRef = React.useRef<HTMLElement>(null);
  const itemsScrollRef = React.useRef(0);
  const handleMainScroll = React.useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      if (view.kind === "items") {
        itemsScrollRef.current = event.currentTarget.scrollTop;
      }
    },
    [view.kind],
  );
  React.useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    main.scrollTop = view.kind === "items" ? itemsScrollRef.current : 0;
  }, [view]);
  return { mainRef, handleMainScroll };
};

// The app shell: a translucent, resizable sidebar and a content pane. The
// shell owns the one selection (All items, Review, a single item, or the
// Version info); the sidebar highlights it and the pane renders it.
const sameView = (a: View, b: View) => {
  if (a.kind !== b.kind) return false;
  if (a.kind === "item" && b.kind === "item") return a.id === b.id;
  if (a.kind === "review" && b.kind === "review") return a.itemId === b.itemId;
  return true;
};

export const AppShell = ({
  // Item to land on (the extension's `/?item=<id>` contract); back still
  // reaches the review landing view underneath it.
  initialItemId,
}: {
  initialItemId?: string;
}) => {
  useWindowVibrancy();
  // Browser-style history over the view state: navigating pushes, back and
  // forward walk the stack (⌘[ / ⌘], or the sidebar arrows).
  const [history, setHistory] = React.useState<{
    stack: View[];
    index: number;
    // Review is the landing view: the app opens ready to dip into a card.
  }>(() =>
    initialItemId
      ? {
          stack: [{ kind: "review" }, { kind: "item", id: initialItemId }],
          index: 1,
        }
      : { stack: [{ kind: "review" }], index: 0 },
  );
  const view = React.useMemo<View>(
    () => history.stack[history.index] ?? { kind: "items" },
    [history],
  );
  const setView = React.useCallback((next: View) => {
    setHistory((current) => {
      const at = current.stack[current.index];
      if (at && sameView(at, next)) return current;
      const stack = [...current.stack.slice(0, current.index + 1), next];
      return { stack, index: stack.length - 1 };
    });
  }, []);
  const canGoBack = history.index > 0;
  const canGoForward = history.index < history.stack.length - 1;
  const goBack = React.useCallback(
    () =>
      setHistory((current) =>
        current.index > 0 ? { ...current, index: current.index - 1 } : current,
      ),
    [],
  );
  const goForward = React.useCallback(
    () =>
      setHistory((current) =>
        current.index < current.stack.length - 1
          ? { ...current, index: current.index + 1 }
          : current,
      ),
    [],
  );

  // ⌘K opens the item palette.
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  // ⌘[ / ⌘] navigate, Chrome-style; ⌘K toggles the palette.
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey)
        return;
      if (event.key === "[") {
        event.preventDefault();
        goBack();
      } else if (event.key === "]") {
        event.preventDefault();
        goForward();
      } else if (event.key === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, goForward]);
  const [sidebarOpen, setSidebarOpen] = React.useState(
    () =>
      typeof window === "undefined" ||
      window.localStorage.getItem("app-sidebar-open") !== "false",
  );
  const toggleSidebar = React.useCallback(() => {
    setSidebarOpen((prev) => {
      try {
        window.localStorage.setItem("app-sidebar-open", String(!prev));
      } catch {}
      return !prev;
    });
  }, []);
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });
  const queryClient = useQueryClient();
  // Keep the deck warm so the review tab derives its queue instantly from
  // cache instead of showing a skeleton.
  React.useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ["all-flashcards"],
      queryFn: getAllFlashcards,
    });
  }, [queryClient]);
  // Surface the in-memory selection in the dev banner.
  React.useEffect(() => {
    publishDevView(view);
    return () => publishDevView(null);
  }, [view]);

  const openItem = React.useCallback(
    (id: string) => setView({ kind: "item", id }),
    [setView],
  );
  useDeepLinkedItem(openItem);
  const { mainRef, handleMainScroll } = usePaneScrollMemory(view);
  // Jump straight to one card inside an item's notes (from a review card).
  const [cardFocus, setCardFocus] = React.useState<{
    itemId: string;
    cardId: string;
    nonce: number;
  } | null>(null);
  const openCardInNotes = React.useCallback(
    (itemId: string, cardId: string) => {
      setCardFocus((current) => ({
        itemId,
        cardId,
        nonce: (current?.nonce ?? 0) + 1,
      }));
      setView({ kind: "item", id: itemId });
    },
    [setView],
  );
  // Targeted "edit this item's link" request: opens the item (if needed) and
  // its link dialog. The nonce lets repeat requests on the same item re-open.
  const [urlEdit, setUrlEdit] = React.useState<{
    itemId: string;
    nonce: number;
  } | null>(null);
  const requestUrlEdit = React.useCallback(
    (itemId: string) => {
      setUrlEdit((current) => ({ itemId, nonce: (current?.nonce ?? 0) + 1 }));
      setView({ kind: "item", id: itemId });
    },
    [setView],
  );

  // Commands from rows anywhere in the app (context menus can't thread
  // callbacks through every list).
  useViewCommands((command) => {
    if (command.kind === "edit-link") requestUrlEdit(command.itemId);
    else if (command.kind === "review-item")
      setView({ kind: "review", itemId: command.itemId });
  });

  // Requests are one-shot: navigating away from their target item consumes
  // them, so coming back (history or otherwise) doesn't replay the dialog or
  // the card jump.
  React.useEffect(() => {
    if (urlEdit && !(view.kind === "item" && view.id === urlEdit.itemId)) {
      setUrlEdit(null);
    }
    if (cardFocus && !(view.kind === "item" && view.id === cardFocus.itemId)) {
      setCardFocus(null);
    }
  }, [view, urlEdit, cardFocus]);
  const { createFromUrl, createBlank, pasteFromClipboard } =
    useCreateItem(openItem);

  // Global paste: a URL pasted anywhere outside an editable field becomes a
  // new item, confirmed by a notification.
  React.useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      const url = clipboardUrl(
        event.clipboardData?.getData("text/plain") ?? "",
      );
      if (!url) return;
      event.preventDefault();
      createFromUrl(url);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [createFromUrl]);
  const selectedItem =
    view.kind === "item"
      ? (items?.find((item) => item.id === view.id) ?? null)
      : null;

  // The open item can vanish under us (deleted here or on another device);
  // fall back to All items rather than an empty pane.
  React.useEffect(() => {
    if (view.kind === "item" && items && !selectedItem) {
      setView({ kind: "items" });
    }
  }, [view, items, selectedItem, setView]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <AppSidebar
        view={view}
        onViewChange={setView}
        onNewItem={createBlank}
        onPasteUrl={pasteFromClipboard}
        open={sidebarOpen}
        onToggle={toggleSidebar}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={goBack}
        onForward={goForward}
      />
      <div className="relative min-w-0 flex-1">
        <div className="electron-top-bar-inset panel-toolbar absolute inset-x-0 top-0 z-10 flex h-12 items-center px-2">
          {/* With the sidebar closed the traffic lights float over the main
              pane; the reopen toggle sits next to them, same spot as before. */}
          {!sidebarOpen && (
            <Tooltip content="Show sidebar">
              <Button
                data-no-drag
                variant="ghost"
                size="icon-md"
                aria-label="Show sidebar"
                onClick={toggleSidebar}
              >
                <IconLayoutSidebar />
              </Button>
            </Tooltip>
          )}
        </div>
        {view.kind === "item" && selectedItem && (
          <ItemViewActions
            item={selectedItem}
            className="absolute top-2.5 right-3 z-20"
            onEditLink={() => requestUrlEdit(selectedItem.id)}
            onReviewItem={() =>
              setView({ kind: "review", itemId: selectedItem.id })
            }
          />
        )}
        <main
          ref={mainRef}
          onScroll={handleMainScroll}
          className="h-full overflow-y-auto bg-background"
        >
          {view.kind === "items" && <AllItems onOpen={openItem} />}
          {view.kind === "review" && (
            <ReviewPane
              key={view.itemId ?? "due"}
              itemId={view.itemId}
              onOpenCardInNotes={openCardInNotes}
            />
          )}
          {view.kind === "version" && <VersionPane />}
          {view.kind === "item" && selectedItem && (
            <ItemView
              key={selectedItem.id}
              item={selectedItem}
              urlEdit={
                urlEdit?.itemId === selectedItem.id
                  ? { nonce: urlEdit.nonce }
                  : undefined
              }
              cardFocus={
                cardFocus?.itemId === selectedItem.id ? cardFocus : undefined
              }
            />
          )}
        </main>
      </div>
      <ItemPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onOpen={openItem}
      />
    </div>
  );
};
