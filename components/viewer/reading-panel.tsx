// The reading panel: hosts the viewer (toolbar + stage) for one item. It
// stands in for the items list rather than joining the layout as a third
// column, so reading is a two-pane view — source on the left, notes on the
// right.
//
// Deliberately not a panel, despite the name. The item panel beside it is a
// floating card (border, radius, shadow, its own surface); this is bare
// content sitting in the main column on the app background, exactly like the
// list it replaces. Giving it card chrome would read as a third thing stacked
// over the layout instead of the main column changing what it shows.
//
// It doesn't slide in from an edge, because it isn't arriving from anywhere:
// it dissolves in over the list it stands in for, and back out on close.
//
// Its size is derived, never owned: whatever renders the notes publishes
// where the main column ends as --notes-inset-right / --notes-inset-bottom
// (SlidingItemPanel in the main window, ItemWindow in a detached one), and
// this reads that straight into its trailing insets. That leaves exactly one
// resize handle on the single boundary between the panes, and lets a drag
// move both sides without a React render on this one. --notes-resize-ms is
// that publisher's way of killing this panel's easing for the duration of a
// drag, so the two edges stay glued together instead of one easing after the
// other.
//
// Notes never live inside this panel: they're the regular item panel.
import React from "react";

import { pushDismissLayer } from "@/lib/dismiss-stack";
import { EASE, FADE_MS, SLIDE_OFFSET } from "@/lib/motion";
import { type Item } from "@/lib/types";
import { useSlideIn } from "@/lib/use-slide-in";
import { cn } from "@/lib/utils";

import { ViewerHeader } from "./viewer-header";
import { openExternally, ViewerStage } from "./viewer-stage";

// Expand/restore animation for the panel's trailing edges.
const EXPAND_MS = 280;

export const ReadingPanel = ({
  item,
  exiting = false,
  inset = SLIDE_OFFSET,
  onClose,
  expanded,
  onExpandedChange,
}: {
  item: Item;
  // The parent keeps this mounted for FADE_MS after closing (lib/use-linger)
  // so the dissolve back to the list can play out.
  exiting?: boolean;
  // Padding around the column this stands in for: the main window's layout is
  // padded (p-2), a detached item window is edge-to-edge. Matching it is what
  // makes this land in the same box as the content it replaces.
  inset?: number;
  onClose: () => void;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
}) => {
  // Fade in on mount (see lib/use-slide-in.ts for the choreography).
  const { entered, settled } = useSlideIn(FADE_MS);

  const handleOpenExternal = React.useCallback(() => {
    openExternally(item.url);
  }, [item.url]);

  // Escape via the app's dismiss stack (lib/dismiss-stack.ts). The item
  // panel registers its layer a frame after mount (its open animation), so a
  // plain mount-time push would land UNDER it and Escape would close notes
  // before the reader. Register after a short delay so the reader starts on
  // top; later interactions promote whichever panel was touched last (the
  // stack's focus rule), which is the intended recency behavior.
  const panelRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  React.useEffect(() => {
    if (!settled || exiting) return;
    return pushDismissLayer(() => onCloseRef.current(), {
      contains: (node) => panelRef.current?.contains(node) ?? false,
    });
  }, [settled, exiting]);

  const handleToggleExpanded = React.useCallback(() => {
    onExpandedChange(!expanded);
  }, [expanded, onExpandedChange]);

  // The notes publish where the main column ends, gaps and all (see
  // SlidingItemPanel), so this is a straight read rather than an arithmetic
  // one — the two axes need different gaps and that difference belongs with
  // the panel that creates it. With no notes open the fallback is the
  // layout's own padding. Expanded means the notes are covered rather than
  // moved: the insets collapse back to that padding and this grows over them.
  const trailingEdges = expanded
    ? { right: inset, bottom: inset }
    : {
        right: `var(--notes-inset-right, ${inset}px)`,
        bottom: `var(--notes-inset-bottom, ${inset}px)`,
      };

  return (
    /* Fixed so its resize never reflows the list underneath. z-[35] sits above
       the restored item panel's z-30, so expanding grows over the stationary
       notes rather than pushing them aside; the item panel outranks this one
       again when *it* expands.

       No border, radius, shadow, or surface colour: this is the main column's
       own content, on the app background, in the same box the list occupies. */
    <div
      ref={panelRef}
      className={cn(
        "reader-panel fixed z-[35] flex flex-col overflow-hidden bg-background",
        exiting ? "pointer-events-none" : "pointer-events-auto",
      )}
      style={{
        top: inset,
        left: inset,
        ...trailingEdges,
        opacity: entered && !exiting ? 1 : 0,
        transition: [
          `opacity ${FADE_MS}ms ${EASE}`,
          `right var(--notes-resize-ms, ${EXPAND_MS}ms) ${EASE}`,
          `bottom var(--notes-resize-ms, ${EXPAND_MS}ms) ${EASE}`,
        ].join(", "),
      }}
    >
      <ViewerHeader
        fallbackUrl={item.url}
        onClose={onClose}
        onOpenExternal={handleOpenExternal}
        expanded={expanded}
        onToggleExpanded={handleToggleExpanded}
      />
      <ViewerStage item={item} />
    </div>
  );
};
