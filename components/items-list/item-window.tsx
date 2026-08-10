import { useQuery } from "@tanstack/react-query";
import React from "react";

import { ReadingPanel } from "@/components/viewer/reading-panel";
import { FADE_MS } from "@/lib/motion";
import { subscribeReadItem } from "@/lib/panel-events";
import { fetchItems } from "@/lib/queries";
import { type Item } from "@/lib/types";
import { useLinger } from "@/lib/use-linger";

import { PanelInner } from "./panel-inner";
import { clampEffective, usePanelSize, useViewportSize } from "./panel-sizing";

// A dedicated single-item window (opened via openItemInNewWindow → ?window=1).
// Unlike the sliding side panel, there's no list behind it and no close or
// collapse chrome — the whole window *is* the item, edge-to-edge. It reuses
// PanelInner with its "window" chrome.
//
// "Read in app" works here too, and the geometry mirrors the main window one
// level down: the reader takes the left, the notes keep the right. There the
// reader replaces the items list; here it replaces the item content's own
// full-bleed column, which narrows to a notes pane for the duration.
export const ItemWindow = ({ itemId }: { itemId: string }) => {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });
  const [reading, setReading] = React.useState(false);
  const [readerExpanded, setReaderExpanded] = React.useState(false);

  // Deleting the item from the ⋯ menu leaves nothing to show, so close the
  // window. Also the target of the (hidden) close path inside PanelInner.
  const handleClose = React.useCallback(() => {
    window.close();
  }, []);

  const handleCloseReading = React.useCallback(() => {
    setReading(false);
    setReaderExpanded(false);
  }, []);

  // Only ever this window's own item — the menu that dispatches lives inside
  // this very panel, so there is no other id it could carry.
  React.useEffect(() => subscribeReadItem(() => setReading(true)), []);

  const liveReadingItem = reading
    ? (items?.find((i) => i.id === itemId) ?? null)
    : null;
  // Outlives its own close by one fade so the reader can dissolve away.
  const { value: readingItem, exiting: readerExiting } = useLinger(
    liveReadingItem,
    FADE_MS,
  );

  // The notes column borrows the item panel's own persisted width — the one
  // setting that actually means "how wide are the notes" — and above all its
  // viewport clamp, which reserves PANEL_SIZE_CONFIG.width.viewportGutter for
  // whatever sits beside it. Without that clamp a stored width wider than the
  // window (this window opens at 600, the old reader-width default was 640)
  // overflows a `flex-shrink: 0` column and drives the reader's inset past the
  // window edge, collapsing it to nothing.
  const [desiredNotesWidth] = usePanelSize("width");
  const viewport = useViewportSize();
  const notesWidth = clampEffective("width", desiredNotesWidth, viewport.w);

  // Where the reader has to stop (see reading-panel.tsx). Nothing floats in
  // this window — the notes column is flush to the right edge — so the width
  // is the whole inset, with no gap folded in. There's no resize handle here,
  // so it only moves when the window does.
  React.useEffect(() => {
    const root = document.documentElement;
    if (!liveReadingItem) {
      root.style.removeProperty("--notes-inset-right");
      return;
    }
    root.style.setProperty("--notes-inset-right", `${notesWidth}px`);
    return () => {
      root.style.removeProperty("--notes-inset-right");
    };
  }, [liveReadingItem, notesWidth]);

  return (
    <div className="fixed inset-0 flex justify-end overflow-hidden bg-surface">
      {/* Covered by an expanded reader — keep buried controls out of the
          focus and hover order (same treatment as the main window's list). */}
      <div
        className="flex min-w-0 flex-1 flex-col"
        // Live, not lingering: the notes retake the window as the reader
        // dissolves off them, rather than snapping wide once it's gone.
        style={liveReadingItem ? { flex: `0 0 ${notesWidth}px` } : undefined}
        inert={readerExpanded && liveReadingItem ? true : undefined}
      >
        <PanelInner itemId={itemId} chrome="window" onClose={handleClose} />
      </div>
      {readingItem && (
        <ReadingPanel
          key={readingItem.id}
          item={readingItem}
          exiting={readerExiting}
          // This window has no layout padding — the item content it stands in
          // for runs edge-to-edge, so this does too.
          inset={0}
          onClose={handleCloseReading}
          expanded={readerExpanded}
          onExpandedChange={setReaderExpanded}
        />
      )}
    </div>
  );
};
