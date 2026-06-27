import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import React from "react";

import { useVirtualScrollRef } from "./virtual-scroll-context";

// useLayoutEffect warns during SSR; fall back to useEffect on the server. The
// list only renders meaningfully on the client (it needs a scroll element), so
// the visual cost of the fallback is nil.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

type VirtualListProps<T> = {
  items: T[];
  // Stable identity per item — used for React keys *and* as the virtualizer's
  // index key so measured heights survive reorders.
  getKey: (item: T) => string;
  // Fixed row height (px). Rows are a uniform height per density, so we use a
  // fixed size instead of per-row measurement — that avoids a ResizeObserver on
  // every rendered row (which would re-read layout on every frame of a width
  // animation, e.g. the detail panel on Cmd+K). Must match the real row height.
  estimateSize: number;
  // The shared scroll container. This list does NOT own scrolling — it windows
  // against a parent viewport that may hold other content (headers, pinned,
  // suggested) above it. Optional: falls back to the nearest
  // `VirtualScrollProvider` so the list can be dropped in without prop drilling.
  scrollElementRef?: React.RefObject<HTMLElement | null>;
  // Rows to render above/below the visible window so fast scrolls don't flash
  // blank. Each row is cheap-ish, so a few extra is fine.
  overscan?: number;
  // Receives the underlying virtualizer (and null on unmount) so the parent can
  // scroll an off-screen row into view via `scrollToIndex`.
  onVirtualizerChange?: (
    virtualizer: Virtualizer<HTMLElement, Element> | null,
  ) => void;
  children: (item: T, index: number) => React.ReactNode;
};

/**
 * Headless windowing primitive. Renders only the rows intersecting the parent
 * scroll viewport (plus overscan), keeping the DOM small for arbitrarily long
 * lists. Built on `@tanstack/react-virtual`.
 *
 * The list sits inside a *shared* scroll container, below other content, so it
 * computes its own `scrollMargin` — the distance from the top of the scroll
 * content to the top of this list — and re-measures it whenever the content
 * above changes height (e.g. the Pinned/Suggested sections collapse).
 *
 * Rows are a fixed height per density (no per-row measurement), so stacking many
 * of these in one scroller stays cheap during layout animations.
 */
export const VirtualList = <T,>({
  items,
  getKey,
  estimateSize,
  scrollElementRef,
  overscan = 12,
  onVirtualizerChange,
  children,
}: VirtualListProps<T>) => {
  const contextScrollRef = useVirtualScrollRef();
  const scrollRef = scrollElementRef ?? contextScrollRef;
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = React.useState(0);

  // Keep `scrollMargin` in sync with this list's offset inside the shared
  // viewport. With several lists stacked in one scroller, a single on-mount read
  // is fragile: a StrictMode remount or late reflow can leave a list's offset
  // stale, and when row heights match the estimate no resize fires to fix it —
  // so an off-screen list would wrongly render rows. We re-measure on every
  // signal that can shift our top edge: resize of the viewport or scroll
  // content, the next settled frame, and scroll (offset-invariant, so it's a
  // cheap self-correction the moment the user scrolls).
  useIsomorphicLayoutEffect(() => {
    const scrollEl = scrollRef?.current;
    const inner = innerRef.current;
    if (!scrollEl || !inner) return;

    const measure = () => {
      const offset =
        inner.getBoundingClientRect().top -
        scrollEl.getBoundingClientRect().top +
        scrollEl.scrollTop;
      // Guard skips no-op updates, so the scroll listener below is essentially
      // free while scrolling (offset doesn't change) and only fires on real
      // layout shifts above us.
      setScrollMargin((prev) =>
        Math.abs(prev - offset) > 0.5 ? offset : prev,
      );
    };

    measure();

    // Re-measure after layout has fully settled (two frames covers StrictMode's
    // mount/remount churn).
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (!cancelled) measure();
      });
    });

    // Our offset only moves when content *above* us changes height. Observe the
    // scroll content for HEIGHT changes only, ignoring width-only changes (e.g.
    // the detail panel animating the list's width on Cmd+K) — otherwise every
    // frame of that 280ms animation would force a reflow here, once per mounted
    // group. The viewport's own size never affects our offset, so we don't
    // observe the scroll element itself.
    const content = scrollEl.firstElementChild;
    let lastHeight = content ? content.getBoundingClientRect().height : -1;
    const observer = new ResizeObserver((entries) => {
      const height = entries[entries.length - 1]?.contentRect.height;
      if (height === undefined || Math.abs(height - lastHeight) < 0.5) return;
      lastHeight = height;
      measure();
    });
    if (content) observer.observe(content);

    // Offset-invariant safety net: scrolling never changes our offset and writes
    // no layout, so this read is cheap (no forced reflow) — it just corrects a
    // margin that somehow went stale.
    scrollEl.addEventListener("scroll", measure, { passive: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      scrollEl.removeEventListener("scroll", measure);
    };
  }, [scrollRef]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef?.current ?? null,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin,
    getItemKey: (index) => getKey(items[index]),
  });

  React.useEffect(() => {
    if (!onVirtualizerChange) return;
    onVirtualizerChange(virtualizer);
    return () => onVirtualizerChange(null);
  }, [virtualizer, onVirtualizerChange]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={innerRef}
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualItems.map((virtualItem) => (
        <div
          key={virtualItem.key}
          data-index={virtualItem.index}
          className="absolute top-0 left-0 w-full pb-px"
          style={{
            height: virtualItem.size,
            transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
          }}
        >
          {children(items[virtualItem.index], virtualItem.index)}
        </div>
      ))}
    </div>
  );
};
