import React from "react";

// Shared positioning + dismissal logic for popovers anchored to a point inside
// the markdown editor (link popover, item-link menu, inline-math editor). The
// anchor is a viewport-space rect (editor.view.coordsAtPos(...) or an element's
// getBoundingClientRect()); the hook returns a fixed-position style that
// follows it on scroll/resize and content reflow, plus optional
// outside-mousedown / Escape dismissal wired to `popoverRef`.

type AnchorRect = { left: number; top: number; bottom: number };

export type UseAnchoredPopoverOptions = {
  open: boolean;
  // Read the anchor's current viewport rect. Return null when it can't be
  // resolved (e.g. coordsAtPos throws) — `style` comes back null and the
  // caller should not render.
  getAnchor: () => AnchorRect | null;
  // Popover width; when given, the left edge is clamped to the viewport
  // (margin px from either side). Omit to place at the anchor's left verbatim.
  width?: number;
  // Gap between the anchor's bottom edge and the popover (default 6).
  offset?: number;
  // Viewport margin used by the horizontal clamp and flip check (default 8).
  margin?: number;
  // Estimated popover height. When given, the popover flips above the anchor
  // (bottom-anchored, so the real height grows upward) if it wouldn't fit
  // below the anchor within the viewport.
  estimateHeight?: () => number;
  // When given, dismissal is handled here: a mousedown outside the popover
  // (and outside `isInside` regions) or an Escape keypress calls it.
  onDismiss?: () => void;
  // Extra regions that count as "inside" for the outside-mousedown check
  // (e.g. the editor DOM, the anchoring node itself).
  isInside?: (target: Node) => boolean;
  // Set false when the caller handles Escape itself (default true).
  closeOnEscape?: boolean;
};

export const useAnchoredPopover = ({
  open,
  getAnchor,
  width,
  offset = 6,
  margin = 8,
  estimateHeight,
  onDismiss,
  isInside,
  closeOnEscape = true,
}: UseAnchoredPopoverOptions): {
  popoverRef: React.RefObject<HTMLDivElement | null>;
  style: React.CSSProperties | null;
} => {
  const [, bumpPosition] = React.useReducer((tick: number) => tick + 1, 0);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Reposition on scroll (capture, so nested scroll containers count) and
  // resize while open.
  React.useEffect(() => {
    if (!open) return;
    const handle = () => bumpPosition();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [open]);

  // Close on Escape or a mousedown outside the popover and `isInside` regions.
  React.useEffect(() => {
    if (!open || !onDismiss) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (isInside?.(target)) return;
      onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", onMouseDown, true);
    if (closeOnEscape) document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      if (closeOnEscape) document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onDismiss, isInside, closeOnEscape]);

  const anchor = open ? getAnchor() : null;

  // Anchors can also move without a scroll/resize (content reflow while
  // typing, KaTeX re-render). The render above reads layout *before* React
  // commits such changes, so re-read after every commit and re-render once if
  // the anchor moved — this converges because the next render reads the fresh
  // rect.
  React.useLayoutEffect(() => {
    if (!open || !anchor) return;
    const next = getAnchor();
    if (!next) return;
    if (
      anchor.left !== next.left ||
      anchor.top !== next.top ||
      anchor.bottom !== next.bottom
    ) {
      bumpPosition();
    }
  });

  let style: React.CSSProperties | null = null;
  if (anchor) {
    const left =
      width == null
        ? anchor.left
        : Math.max(
            margin,
            Math.min(anchor.left, window.innerWidth - width - margin),
          );
    const flipAbove =
      estimateHeight != null &&
      anchor.bottom + offset + estimateHeight() > window.innerHeight - margin;
    style = flipAbove
      ? {
          position: "fixed",
          left,
          bottom: window.innerHeight - anchor.top + offset,
        }
      : { position: "fixed", left, top: anchor.bottom + offset };
  }

  return { popoverRef, style };
};
