import { IconBulb, IconBulbOff, IconChevronRight } from "@tabler/icons-react";
import React from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { type Item } from "@/lib/types";
import { useWindowResize } from "@/lib/use-window-resize";
import { cn } from "@/lib/utils";

import { ItemContextMenu, ItemContextMenuTrigger } from "./item-dropdown";
import { useItemActions } from "./item-row-context";
import { ItemThumbnail } from "./item-thumbnail";

type SuggestedSectionProps = {
  items: Item[];
  open: boolean;
  onToggleOpen: () => void;
  onHide: () => void;
};

/**
 * "Suggested next reads" — a horizontal strip of minimal preview cards above
 * the Pinned section. Each card reuses the cozy-row thumbnail (YouTube thumb /
 * PDF first-page render / page placeholder, with favicon badge) and shows the
 * title beneath. Ranking lives in use-suggestions.
 */
export const SuggestedSection = ({
  items,
  open,
  onToggleOpen,
  onHide,
}: SuggestedSectionProps) => {
  const {
    onActivate,
    onDelete,
    onToggleRead,
    onTogglePin,
    onToggleHiddenFromReview,
  } = useItemActions();
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  // Edge fades hint at off-screen cards: left fades in once scrolled away from
  // the start, right fades out as you reach the end.
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(true);

  // rAF-coalesced: scroll/resize fire at 60Hz+, so instead of a setState per
  // event we schedule at most one pending frame that reads layout and applies
  // the latest fade state.
  const fadeFrameRef = React.useRef<number | null>(null);
  const updateFades = React.useCallback(() => {
    if (fadeFrameRef.current !== null) return;
    fadeFrameRef.current = requestAnimationFrame(() => {
      fadeFrameRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setAtStart(scrollLeft <= 0);
      // 1px slack absorbs sub-pixel rounding at the far edge.
      setAtEnd(scrollLeft >= scrollWidth - clientWidth - 1);
    });
  }, []);

  // Follow viewport resizes that alter how much fits on screen. Registered
  // sync because updateFades already rAF-coalesces internally (the same
  // scheduler serves the scroll handler and the items-change effect below).
  useWindowResize(updateFades, { mode: "sync" });

  // Recompute on mount and whenever the item set (and thus content width)
  // changes.
  React.useEffect(() => {
    updateFades();
    return () => {
      if (fadeFrameRef.current !== null) {
        cancelAnimationFrame(fadeFrameRef.current);
        fadeFrameRef.current = null;
      }
    };
  }, [updateFades, items]);

  if (items.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col">
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              type="button"
              onClick={onToggleOpen}
              className="inline-flex w-fit items-center gap-1 px-1 pb-0.5 text-xs text-muted-foreground transition-colors outline-none select-none hover:text-foreground"
            />
          }
        >
          <IconBulb className="size-3" />
          Suggested
          <IconChevronRight
            className={cn(
              "size-3 transition-transform duration-150",
              open && "rotate-90",
            )}
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <DropdownMenuItem onClick={onHide}>
            <IconBulbOff />
            Hide suggestions
          </DropdownMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {open && (
        <div className="relative">
          <div
            ref={scrollRef}
            onScroll={updateFades}
            className="overflow-x-auto"
          >
            <div className="flex gap-4 px-1 pt-1 pb-2">
              {items.map((item) => (
                <ItemContextMenu
                  key={item.id}
                  item={item}
                  onTogglePin={() => onTogglePin(item.id, !item.starred)}
                  onToggleRead={() => onToggleRead(item.id, !item.read)}
                  onToggleHiddenFromReview={() =>
                    onToggleHiddenFromReview(item.id, !item.hiddenFromReview)
                  }
                  onDelete={() => onDelete(item.id)}
                >
                  <ItemContextMenuTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => onActivate(item.id)}
                        className="flex w-36 shrink-0 flex-col gap-1.5 text-left outline-none"
                      />
                    }
                  >
                    <ItemThumbnail
                      item={item}
                      className="aspect-video w-full rounded-md"
                    />
                    <span className="truncate font-content text-xs text-muted-foreground">
                      {item.title || "Untitled"}
                    </span>
                  </ItemContextMenuTrigger>
                </ItemContextMenu>
              ))}
            </div>
          </div>
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-background to-transparent transition-opacity duration-200",
              atStart ? "opacity-0" : "opacity-100",
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-background to-transparent transition-opacity duration-200",
              atEnd ? "opacity-0" : "opacity-100",
            )}
          />
        </div>
      )}
    </div>
  );
};
