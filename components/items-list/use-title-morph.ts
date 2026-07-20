// Scroll-linked title morph for PanelInner: interpolates the content title
// row toward the toolbar's header slot via direct style writes, and owns the
// derived `scrolled` flag (plus the per-item scroll reset that clears it).
import React from "react";

import { type Item } from "@/lib/types";

// DOM-mutating pieces live at module scope so the hook body itself never
// mutates values derived from its arguments (react-compiler rejects that
// inside the hook — the refs are hook args here, not local useRefs).
const resetScrollTop = (el: HTMLElement | null) => {
  if (el) el.scrollTop = 0;
};

const THRESHOLD = 48;
const CONTENT_ICON = 24;
const HEADER_ICON = 14;
const CONTENT_FONT = 20; // text-xl on the title in DetailPanel
const HEADER_FONT = 12;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * (2 - t);

// Wires the morph to a scroll container: positions/fades the morph row via
// direct style writes on every scroll/resize event, reports the scrolled
// flag through onScrolled, and returns the teardown function.
const attachTitleMorph = ({
  scrollEl,
  morphRef,
  headerSlotRef,
  onScrolled,
}: {
  scrollEl: HTMLDivElement;
  morphRef: React.RefObject<HTMLDivElement | null>;
  headerSlotRef: React.RefObject<HTMLDivElement | null>;
  onScrolled: (scrolled: boolean) => void;
}) => {
  const update = () => {
    const morph = morphRef.current;
    const headerSlot = headerSlotRef.current;
    const contentRow = scrollEl.querySelector<HTMLElement>("[data-title-row]");
    const containingBlock = morph?.parentElement;
    if (!morph || !headerSlot || !contentRow || !containingBlock) return;

    const panelRect = containingBlock.getBoundingClientRect();
    const scrollY = Math.max(0, scrollEl.scrollTop);
    const rawT = Math.min(scrollY / THRESHOLD, 1);
    const t = ease(rawT);

    // React bails out of the re-render when the value is unchanged, so a
    // direct set is correct and avoids the stale effect-local guard that
    // left the fade stuck on after navigating to an unscrolled item.
    onScrolled(scrollY > 0);

    if (rawT <= 0) {
      morph.style.opacity = "0";
      contentRow.style.visibility = "";
      return;
    }

    contentRow.style.visibility = "hidden";

    const contentRect = contentRow.getBoundingClientRect();
    const headerRect = headerSlot.getBoundingClientRect();
    const x = lerp(
      contentRect.left - panelRect.left,
      headerRect.left - panelRect.left,
      t,
    );
    const y = lerp(
      contentRect.top - panelRect.top,
      headerRect.top - panelRect.top,
      t,
    );
    const iconSize = lerp(CONTENT_ICON, HEADER_ICON, t);
    const fontSize = lerp(CONTENT_FONT, HEADER_FONT, t);
    const gap = lerp(8, 6, t);
    const maxWidth = lerp(contentRect.width, headerRect.width, t);

    morph.style.transform = `translate(${x}px, ${y}px)`;
    morph.style.fontSize = `${fontSize}px`;
    morph.style.gap = `${gap}px`;
    morph.style.maxWidth = `${maxWidth}px`;
    morph.style.opacity = "1";

    const icon = morph.querySelector<HTMLElement>("[data-morph-icon]");
    if (icon) {
      icon.style.width = `${iconSize}px`;
      icon.style.height = `${iconSize}px`;
    }
  };

  update();
  scrollEl.addEventListener("scroll", update, { passive: true });
  // Per-event on purpose: update() repositions the morph via direct style
  // writes off live rects — debouncing would leave the morphed title
  // visibly misplaced while the panel geometry changes. Its onScrolled
  // bails out of re-rendering whenever the value is unchanged.
  window.addEventListener("resize", update);
  const raf = requestAnimationFrame(update);
  return () => {
    scrollEl.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
    cancelAnimationFrame(raf);
    const contentRow = scrollEl.querySelector<HTMLElement>("[data-title-row]");
    if (contentRow) contentRow.style.visibility = "";
  };
};

export const useTitleMorph = ({
  scrollRef,
  morphRef,
  headerSlotRef,
  item,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  morphRef: React.RefObject<HTMLDivElement | null>;
  headerSlotRef: React.RefObject<HTMLDivElement | null>;
  item: Item | null;
}) => {
  const [scrolled, setScrolled] = React.useState(false);

  // The scroll container persists across items, so opening a *different* item
  // would otherwise inherit the previous one's scroll offset — and a stuck
  // top fade. Reset both to the top when the item id changes. Keyed on id (not
  // the item object) so editing the current item doesn't jump the scroll.
  React.useLayoutEffect(() => {
    resetScrollTop(scrollRef.current);
    setScrolled(false);
  }, [scrollRef, item?.id]);

  // Title morph: as the user scrolls the panel's inner container, the title
  // row in the content interpolates toward the empty slot in the toolbar,
  // shrinking and fading from content position into the header.
  React.useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    return attachTitleMorph({
      scrollEl,
      morphRef,
      headerSlotRef,
      onScrolled: setScrolled,
    });
  }, [scrollRef, morphRef, headerSlotRef, item]);

  return scrolled;
};
