import { IconChevronRight, IconPinFilled } from "@tabler/icons-react";
import React from "react";

import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ItemList } from "./item-list";
import { scrollIntoViewWithMargin, useNavSection } from "./list-nav-registry";
import { useVirtualScrollRef } from "./virtual-scroll-context";

type PinnedSectionProps = {
  items: Item[];
  open: boolean;
  onToggleOpen: () => void;
};

/**
 * Collapsible "Pinned" group rendered above the main list. Shared by both the
 * grouped and flat list layouts so the two only differ in their body.
 */
export const PinnedSection = ({
  items,
  open,
  onToggleOpen,
}: PinnedSectionProps) => {
  const scrollRef = useVirtualScrollRef();
  const sectionRef = React.useRef<HTMLDivElement>(null);
  // Read latest values inside the stable nav-section closures.
  const itemsRef = React.useRef(items);
  itemsRef.current = items;
  const openRef = React.useRef(open);
  openRef.current = open;

  // Pinned rows aren't virtualized (the section is bounded), so they're always
  // in the DOM — register them for keyboard nav with a plain DOM scroll.
  useNavSection({
    getElement: () => sectionRef.current,
    getIds: () =>
      openRef.current ? itemsRef.current.map((item) => item.id) : [],
    scrollToId: (id) => {
      if (!openRef.current || !itemsRef.current.some((item) => item.id === id))
        return false;
      const el = document.querySelector<HTMLElement>(`[data-item-id="${id}"]`);
      if (el && scrollRef?.current)
        scrollIntoViewWithMargin(scrollRef.current, el);
      return true;
    },
  });

  if (items.length === 0) return null;

  return (
    <div ref={sectionRef} className="mb-4 flex flex-col">
      <button
        type="button"
        onClick={onToggleOpen}
        className="inline-flex items-center gap-1 px-1 pb-0.5 text-xs text-muted-foreground transition-colors outline-none select-none hover:text-foreground"
      >
        <IconPinFilled className="size-3" />
        Pinned
        <IconChevronRight
          className={cn(
            "size-3 transition-transform duration-150",
            open && "rotate-90",
          )}
        />
      </button>
      {open && <ItemList items={items} />}
    </div>
  );
};
