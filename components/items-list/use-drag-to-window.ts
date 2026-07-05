import React from "react";

import { openItemInNewWindow } from "@/lib/app-windows";
import { type Item } from "@/lib/types";

// EXPERIMENT: tear-off drag. Press-and-drag a list row past the edge of the
// window and release to pop the item out into its own window (openItemInNewWindow).
// Pointer-based rather than HTML5 DnD so we get pointer coordinates that keep
// updating (and go out of bounds) while a button is held — the same window-level
// pointermove/pointerup pattern the panel resize handle uses. HTML5 DnD can't
// report a drop outside the window.

// How far the pointer must travel before a press becomes a drag (vs. a click).
const DRAG_THRESHOLD = 6;

export type DragToWindowState = {
  x: number;
  y: number;
  // True once the pointer has left the viewport — release here tears off.
  outside: boolean;
};

// Ignore presses that begin on interactive descendants — buttons, links, the
// ⋯ menu, checkboxes, editable fields — so their own gestures still work.
const INTERACTIVE_SELECTOR =
  "button, a, input, textarea, [role='menuitem'], [data-item-link], [contenteditable='true']";

const isOutsideViewport = (x: number, y: number) =>
  x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight;

export const useDragToWindow = (item: Item) => {
  const [drag, setDrag] = React.useState<DragToWindowState | null>(null);
  // Set while a press is resolving into (or has just finished) a drag, so the
  // row's click handler can distinguish a drag-release from a real click.
  const draggedRef = React.useRef(false);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;

      const startX = e.clientX;
      const startY = e.clientY;
      draggedRef.current = false;
      let active = false;

      const onMove = (ev: PointerEvent) => {
        if (
          !active &&
          Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD
        ) {
          return;
        }
        if (!active) {
          active = true;
          draggedRef.current = true;
        }
        setDrag({
          x: ev.clientX,
          y: ev.clientY,
          outside: isOutsideViewport(ev.clientX, ev.clientY),
        });
      };

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (active && isOutsideViewport(ev.clientX, ev.clientY)) {
          openItemInNewWindow(item.id);
        }
        setDrag(null);
        // Let the click that follows pointerup see draggedRef, then clear it.
        setTimeout(() => {
          draggedRef.current = false;
        }, 0);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [item.id],
  );

  // Suppress text selection for the duration of a drag. Kept in an effect (not
  // the pointer handlers) so the body mutation is a declared side effect.
  const dragging = drag !== null;
  React.useEffect(() => {
    if (!dragging) return;
    const previous = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previous;
    };
  }, [dragging]);

  return { onPointerDown, drag, wasDragged: () => draggedRef.current };
};
