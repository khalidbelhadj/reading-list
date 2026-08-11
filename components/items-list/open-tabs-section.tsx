import { IconBrowser, IconChevronRight } from "@tabler/icons-react";
import React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ItemList } from "./item-list";
import {
  scrollIntoViewWithMargin,
  scrollToCenter,
  useNavSection,
} from "./list-nav-registry";
import { useVirtualScrollRef } from "./virtual-scroll-context";

type OpenTabsSectionProps = {
  items: Item[];
  open: boolean;
  onToggleOpen: () => void;
};

/**
 * "Open in browser" — items that are also open in a local browser tab right
 * now, surfaced above Pinned so you can jump straight into notes for whatever
 * you're reading. Transient and desktop-only: the section vanishes when the
 * tabs close, and the membership comes from lib/open-tabs (never the server).
 *
 * Deliberately separate from Pinned rather than folded into it — pinning is a
 * durable choice the user made, this is a fact about right now.
 */
export const OpenTabsSection = ({
  items,
  open,
  onToggleOpen,
}: OpenTabsSectionProps) => {
  const scrollRef = useVirtualScrollRef();
  const sectionRef = React.useRef<HTMLDivElement>(null);
  // Read latest values inside the stable nav-section closures.
  const itemsRef = React.useRef(items);
  itemsRef.current = items;
  const openRef = React.useRef(open);
  openRef.current = open;

  // Bounded section, so rows aren't virtualized and are always in the DOM —
  // register them for keyboard nav with a plain DOM scroll (same contract as
  // PinnedSection).
  useNavSection({
    getElement: () => sectionRef.current,
    getIds: () =>
      openRef.current ? itemsRef.current.map((item) => item.id) : [],
    scrollToId: (id, opts) => {
      if (!openRef.current || !itemsRef.current.some((item) => item.id === id))
        return false;
      const el = document.querySelector<HTMLElement>(`[data-item-id="${id}"]`);
      if (el && scrollRef?.current) {
        if (opts?.center) scrollToCenter(scrollRef.current, el);
        else scrollIntoViewWithMargin(scrollRef.current, el);
      }
      return true;
    },
  });

  if (items.length === 0) return null;

  return (
    <div ref={sectionRef} className="mb-4 flex flex-col">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={onToggleOpen}
              className="inline-flex w-fit items-center gap-1 px-1 pb-0.5 text-xs text-muted-foreground transition-colors outline-none select-none hover:text-foreground"
            />
          }
        >
          <IconBrowser className="size-3" />
          Open in browser
          <IconChevronRight
            className={cn(
              "size-3 transition-transform duration-150",
              open && "rotate-90",
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          These items are open in a tab in your browser right now, so you can
          jump straight into your notes. Nothing about your tabs leaves this
          Mac. Turn it off in settings.
        </TooltipContent>
      </Tooltip>
      {open && <ItemList items={items} />}
    </div>
  );
};
