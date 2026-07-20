import { useQuery } from "@tanstack/react-query";
import React from "react";

import { ReadingPanel } from "@/components/viewer/reading-panel";
import { subscribeReadItem } from "@/lib/panel-events";
import { fetchItems } from "@/lib/queries";
import { type Item } from "@/lib/types";
import { useSettings } from "@/lib/use-settings";

import { PanelInner } from "./panel-inner";

// A dedicated single-item window (opened via openItemInNewWindow → ?window=1).
// Unlike the sliding side panel, there's no list behind it and no close or
// collapse chrome — the whole window *is* the item, edge-to-edge. It reuses
// PanelInner with its "window" chrome.
//
// "Read in app" works here too, and the geometry mirrors the main window one
// level down: whatever the reader docks beside becomes the background layer
// it shrinks. There it's the items list with the item panel over it; here the
// item content itself plays that part.
export const ItemWindow = ({ itemId }: { itemId: string }) => {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });
  const { settings, setSetting } = useSettings();

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

  const handlePanelWidthChange = React.useCallback(
    (panelWidth: number) => {
      setSetting("readingPanel", (prev) => ({ ...prev, panelWidth }));
    },
    [setSetting],
  );

  // Only ever this window's own item — the menu that dispatches lives inside
  // this very panel, so there is no other id it could carry.
  React.useEffect(() => subscribeReadItem(() => setReading(true)), []);

  const readingItem = reading
    ? (items?.find((i) => i.id === itemId) ?? null)
    : null;

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-surface">
      {/* Covered by an expanded reader — keep buried controls out of the
          focus and hover order (same treatment as the main window's list). */}
      <div
        className="flex min-w-0 flex-1 flex-col"
        inert={readerExpanded && readingItem ? true : undefined}
      >
        <PanelInner itemId={itemId} chrome="window" onClose={handleClose} />
      </div>
      {readingItem && (
        <ReadingPanel
          key={readingItem.id}
          item={readingItem}
          panelWidth={settings.readingPanel.panelWidth}
          onPanelWidthChange={handlePanelWidthChange}
          onClose={handleCloseReading}
          expanded={readerExpanded}
          onExpandedChange={setReaderExpanded}
        />
      )}
    </div>
  );
};
