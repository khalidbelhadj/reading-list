import { type Virtualizer } from "@tanstack/react-virtual";
import React from "react";

import { type Item } from "@/lib/types";

import { ItemRow } from "./item-row";
import { scrollIntoViewWithMargin, useNavSection } from "./list-nav-registry";
import { useVirtualScrollRef } from "./virtual-scroll-context";
import { VirtualList } from "./virtual-list";
import { resolveRowItem, type Density } from "./utils";

// Fixed row pitch per density (row box + the 1px inter-row gap). Rows are a
// uniform height within a density, so the virtualizer uses these directly
// instead of measuring each row — keeping it cheap during layout animations.
// Must match the real rendered row height (compact ItemRow + cozy thumbnail).
const ROW_HEIGHT: Record<Density, number> = {
  compact: 29,
  cozy: 71,
};

type VirtualItemListProps = {
  items: Item[];
  typingTitles: Record<string, string>;
  suppressHover: boolean;
  density?: Density;
  // Optional explicit scroll viewport; defaults to the nearest
  // VirtualScrollProvider.
  scrollElementRef?: React.RefObject<HTMLElement | null>;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleRead: (id: string, read: boolean) => void;
  onTogglePin: (id: string, starred: boolean) => void;
};

/**
 * Virtualized, self-contained column of item rows. Windows against the shared
 * scroll viewport (from context or an explicit ref) and registers itself as a
 * nav section so keyboard navigation can traverse and scroll to its rows —
 * including ones currently outside the virtualized window. Renders the same
 * {@link ItemRow} as `ItemList`; the 1px inter-row gap is supplied by the
 * `pb-px` on each virtualized row wrapper in {@link VirtualList}.
 */
export const VirtualItemList = ({
  items,
  typingTitles,
  suppressHover,
  density = "compact",
  scrollElementRef,
  onSelect,
  onDelete,
  onToggleRead,
  onTogglePin,
}: VirtualItemListProps) => {
  const contextScrollRef = useVirtualScrollRef();
  const scrollRef = scrollElementRef ?? contextScrollRef;
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const virtualizerRef = React.useRef<Virtualizer<HTMLElement, Element> | null>(
    null,
  );
  // Read inside the (stable) nav-section closures without re-registering.
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const handleVirtualizerChange = React.useCallback(
    (virtualizer: Virtualizer<HTMLElement, Element> | null) => {
      virtualizerRef.current = virtualizer;
    },
    [],
  );

  useNavSection({
    getElement: () => sectionRef.current,
    getIds: () => itemsRef.current.map((item) => item.id),
    scrollToId: (id) => {
      const index = itemsRef.current.findIndex((item) => item.id === id);
      if (index === -1) return false;
      // Mounted (visible or in overscan) — nudge the container with lookahead
      // margin. Otherwise drive the virtualizer to bring the row back.
      const el = document.querySelector<HTMLElement>(`[data-item-id="${id}"]`);
      if (el && scrollRef?.current) {
        scrollIntoViewWithMargin(scrollRef.current, el);
      } else {
        virtualizerRef.current?.scrollToIndex(index, { align: "center" });
      }
      return true;
    },
  });

  return (
    <div ref={sectionRef}>
      <VirtualList
        items={items}
        getKey={(item) => item.id}
        estimateSize={ROW_HEIGHT[density]}
        scrollElementRef={scrollRef ?? undefined}
        onVirtualizerChange={handleVirtualizerChange}
      >
        {(item) => {
          const typingTitle = typingTitles[item.id];
          const rowItem = resolveRowItem(item, typingTitle);
          return (
            <ItemRow
              item={rowItem}
              suppressHover={suppressHover}
              density={density}
              isTyping={typingTitle !== undefined}
              onSelect={() => onSelect(item.id)}
              onDelete={() => onDelete(item.id)}
              onToggleRead={() => onToggleRead(item.id, !item.read)}
              onTogglePin={() => onTogglePin(item.id, !item.starred)}
            />
          );
        }}
      </VirtualList>
    </div>
  );
};
