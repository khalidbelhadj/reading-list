import { useQuery } from "@tanstack/react-query";
import React from "react";

import { ItemsList } from "@/components/items-list";
import { setOpenItemId as setOpenItemIdStore } from "@/components/items-list/cursor-store";
import { ItemWindow } from "@/components/items-list/item-window";
import { SlidingItemPanel } from "@/components/items-list/sliding-item-panel";
import { ReadingPanel } from "@/components/viewer/reading-panel";
import { FADE_MS } from "@/lib/motion";
import { subscribeReadItem } from "@/lib/panel-events";
import { fetchItems } from "@/lib/queries";
import { type Item } from "@/lib/types";
import { useLinger } from "@/lib/use-linger";
import { usePanelView } from "@/lib/use-panel-view";

// The home route renders either the central layout (list + sliding panel) or,
// when opened as a dedicated single-item window (?window=1 via
// openItemInNewWindow), just that item edge-to-edge. Decided once at mount from
// the URL so the two trees never swap for the lifetime of the window.
export const PanelLayout = () => {
  const [itemWindowId] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get("window") == null) return null;
    return params.get("item");
  });

  if (itemWindowId) return <ItemWindow itemId={itemWindowId} />;
  return <MainPanelLayout />;
};

const MainPanelLayout = () => {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  // The four URL-mirrored view facets (item panel, its expanded flag, the
  // reading panel, the reader's expanded flag) and the single writer that
  // moves them — see lib/use-panel-view.ts.
  const { openItemId, expanded, readingItemId, readerExpanded, applyView } =
    usePanelView();

  // Mount the panel only after client hydration. The panel's inline styles
  // depend on orientation (matchMedia), which differs between server and
  // client — deferring avoids the hydration mismatch that would otherwise
  // force React to keep the (wrong) server-rendered orientation.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // On the first home-page visit per session, restore the last-opened item
  // in the panel if it still exists.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("home-visited") === "1") return;
    if (!items) return;
    sessionStorage.setItem("home-visited", "1");
    if (openItemId) return;
    let lastId: string | null = null;
    try {
      lastId = localStorage.getItem("last-item-id");
    } catch {
      return;
    }
    if (!lastId) return;
    if (items.some((i) => i.id === lastId)) {
      applyView({ item: lastId });
    } else {
      try {
        localStorage.removeItem("last-item-id");
      } catch {}
    }
  }, [items, openItemId, applyView]);

  React.useEffect(() => {
    if (!openItemId) return;
    try {
      localStorage.setItem("last-item-id", openItemId);
    } catch {}
  }, [openItemId]);

  // Mirror to the imperative store so list rows highlight the open item
  // without forcing the full list to re-render.
  React.useEffect(() => {
    setOpenItemIdStore(openItemId);
    return () => setOpenItemIdStore(null);
  }, [openItemId]);

  const handleCloseItem = React.useCallback(() => {
    applyView({ item: null, expanded: false });
  }, [applyView]);

  // If the open item disappears from the cache (deleted from anywhere —
  // row dropdown, keyboard shortcut, server refetch), close the panel.
  React.useEffect(() => {
    if (!openItemId || !items) return;
    if (!items.some((i) => i.id === openItemId)) {
      handleCloseItem();
    }
  }, [openItemId, items, handleCloseItem]);

  // How the item panel looked when "Read in app" was invoked, so closing the
  // reader can put the layout back exactly as it was. No panel open at all
  // collapses to "side": leaving the user with nothing after they close the
  // reader would be a worse landing than the preview they came from.
  // Reading itself always drops the notes to the side view — they share the
  // window with the reader — so without this the expanded state would be lost
  // every time someone read an item.
  const preReadingViewRef = React.useRef<"expanded" | "side">("side");

  // Closing the reader gives the list back and hands the layout to whatever
  // the item panel was showing beforehand — expanded stays expanded, a side
  // preview (or nothing) returns to the side view, always on the item that
  // was being read.
  const handleCloseReading = React.useCallback(() => {
    applyView({
      read: null,
      expanded: preReadingViewRef.current === "expanded",
      readerFull: false,
    });
  }, [applyView]);

  // "Read in app": open the reading panel AND the item panel for the same
  // item. The reader takes the list's place on the left, so the notes stay in
  // their ordinary docked side view on the right — the two are a split, not a
  // stack.
  const handleOpenReading = React.useCallback(
    (id: string) => {
      const params = new URLSearchParams(window.location.search);
      const hadAny = params.has("read") || params.has("item");
      // Only the first entry into reading mode records the layout to return
      // to — switching items while reading would otherwise overwrite it with
      // the side view reading itself just imposed.
      if (!params.has("read")) {
        preReadingViewRef.current = params.has("expanded")
          ? "expanded"
          : "side";
      }
      applyView(
        { read: id, item: id, expanded: false, readerFull: false },
        { push: !hadAny },
      );
    },
    [applyView],
  );

  React.useEffect(
    () => subscribeReadItem(handleOpenReading),
    [handleOpenReading],
  );

  // Reading item deleted → close the reading panel too.
  React.useEffect(() => {
    if (!readingItemId || !items) return;
    if (!items.some((i) => i.id === readingItemId)) {
      handleCloseReading();
    }
  }, [readingItemId, items, handleCloseReading]);

  const handleOpenItem = React.useCallback(
    (id: string) => {
      const current = new URLSearchParams(window.location.search).get("item");
      if (current === id) {
        handleCloseItem();
        return;
      }
      applyView({ item: id }, { push: !current });
    },
    [applyView, handleCloseItem],
  );

  const handleOpenItemExpanded = React.useCallback(
    (id: string) => {
      // Open without the toggle-close behavior — Cmd+Enter on an already-open
      // item should expand it, not close it.
      const current = new URLSearchParams(window.location.search).get("item");
      applyView({ item: id, expanded: true }, { push: !current });
    },
    [applyView],
  );

  // Reflect manual expand/restore (toolbar button, Cmd+] / Cmd+[) into the
  // URL so the address bar always points at the current view — replace
  // since toggling the view shouldn't add a history entry.
  const handleExpandedChange = React.useCallback(
    (next: boolean) => {
      applyView({ expanded: next });
    },
    [applyView],
  );

  const readingItem =
    readingItemId != null
      ? (items?.find((i) => i.id === readingItemId) ?? null)
      : null;

  // The reader dissolves rather than unmounting on the spot, so it outlives
  // its id by one fade. Everything below that decides *behaviour* reads
  // `readingItem`; only rendering and the covered-layer flags read this.
  const { value: renderedReadingItem, exiting: readerExiting } = useLinger(
    readingItem,
    FADE_MS,
  );

  // Reading mode owns both panes: the item panel always shows the reading
  // item (never a divergent list selection), docked right of the reader.
  // There is no reader-without-notes state: closing the item panel exits
  // reading mode entirely (see handleCloseItemOrReading).
  const itemPanelId = readingItem ? readingItem.id : openItemId;

  // The item panel's ✕ while reading = leave reading mode completely (back
  // to the bare list). Outside reading it closes the panel as always.
  const handleCloseItemOrReading = React.useCallback(() => {
    if (readingItemId) {
      applyView({ read: null, expanded: false, item: null, readerFull: false });
      return;
    }
    handleCloseItem();
  }, [readingItemId, applyView, handleCloseItem]);

  // Expanding the notes while reading covers the reader rather than closing
  // it, and restoring goes back to the split — the two panes trade which one
  // is full-bleed, and only their ✕ buttons actually leave reading mode.
  // An explicit expand/restore also becomes the layout the reader's own close
  // lands on: the user's latest choice outranks whatever was on screen before
  // they started reading.
  const handleExpandedChangeWithReader = React.useCallback(
    (next: boolean) => {
      if (readingItemId) {
        preReadingViewRef.current = next ? "expanded" : "side";
        applyView({ expanded: next, readerFull: false });
        return;
      }
      handleExpandedChange(next);
    },
    [readingItemId, applyView, handleExpandedChange],
  );

  // Reader expand/restore — replace, since toggling the view isn't a new
  // navigational place.
  const handleReaderExpandedChange = React.useCallback(
    (next: boolean) => applyView({ readerFull: next }),
    [applyView],
  );

  return (
    <div className="h-dvh overflow-hidden">
      <div className="h-full p-2">
        <div className="flex h-full flex-col md:flex-row">
          {/* The list is covered whenever the item panel is expanded or the
              reader has taken its place; make that layer inert so buried
              controls can't hold focus, hover, or tooltips (the browser blurs
              into-inert focus). */}
          <div
            className="contents"
            // Live, not lingering: an exiting reader is already
            // pointer-transparent, and the list should answer to the cursor
            // the moment it starts coming back.
            inert={
              mounted && (expanded || readingItem != null) ? true : undefined
            }
          >
            <ItemsList
              onOpenItem={handleOpenItem}
              onOpenItemExpanded={handleOpenItemExpanded}
            />
          </div>
          {/* The item panel never moves for the reader — an expanded reader
              simply covers it. Same inert treatment as the list above, for
              the same reason: nothing buried under a covering layer should
              keep focus, hover, or tooltips. */}
          <div
            className="contents"
            inert={
              mounted && readerExpanded && readingItem != null
                ? true
                : undefined
            }
          >
            {mounted && (
              <SlidingItemPanel
                itemId={itemPanelId}
                onClose={handleCloseItemOrReading}
                expanded={expanded}
                onExpandedChange={handleExpandedChangeWithReader}
              />
            )}
          </div>
          {/* ...and the mirror of it: expanded notes cover the reader. */}
          <div
            className="contents"
            inert={mounted && expanded ? true : undefined}
          >
            {mounted && renderedReadingItem && (
              <ReadingPanel
                key={renderedReadingItem.id}
                item={renderedReadingItem}
                exiting={readerExiting}
                onClose={handleCloseReading}
                expanded={readerExpanded}
                onExpandedChange={handleReaderExpandedChange}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
