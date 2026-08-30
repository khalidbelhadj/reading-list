import { AnimatePresence, motion } from "motion/react";
import React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

const MARGIN = 8;

// A frost card beside a hovered element. Hand it the current anchor and it
// glides to it: one card, repositioned, rather than one per row appearing
// and disappearing. Non-interactive (pointer events off) so it never steals
// the hover from the row under it; the caller decides when it is open.
export const HoverCard = ({
  anchor,
  open,
  offset = 8,
  // Upper bound; the card shrinks to its content.
  width = 280,
  className,
  children,
}: {
  anchor: HTMLElement | null;
  open: boolean;
  offset?: number;
  width?: number;
  className?: string;
  children: React.ReactNode;
}) => {
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(0);

  React.useLayoutEffect(() => {
    if (!anchor) return;
    const update = () => setRect(anchor.getBoundingClientRect());
    update();
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor]);

  React.useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new ResizeObserver(() => setHeight(card.offsetHeight));
    observer.observe(card);
    setHeight(card.offsetHeight);
    return () => observer.disconnect();
  }, [open, children]);

  const visible = open && rect !== null && typeof document !== "undefined";
  const position = React.useMemo(() => {
    if (!rect) return { x: 0, y: 0 };
    const maxY = Math.max(MARGIN, window.innerHeight - height - MARGIN);
    const maxX = Math.max(MARGIN, window.innerWidth - width - MARGIN);
    return {
      x: Math.min(rect.right + offset, maxX),
      y: Math.min(Math.max(rect.top, MARGIN), maxY),
    };
  }, [rect, offset, width, height]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={cardRef}
          data-slot="hover-card"
          role="tooltip"
          initial={{ opacity: 0, scale: 0.98, x: position.x, y: position.y }}
          animate={{ opacity: 1, scale: 1, x: position.x, y: position.y }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{
            type: "tween",
            duration: 0.18,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{ maxWidth: width }}
          className={cn(
            "glass pointer-events-none fixed top-0 left-0 z-50 w-max rounded-control px-3 py-2.5 text-body text-foreground",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

// Hover tracking for a list of anchors: which element is hovered, with a
// short delay before the first card appears and a grace period when leaving
// so moving between rows glides instead of blinking.
export const useHoverAnchor = ({
  openDelay = 200,
  closeDelay = 120,
}: { openDelay?: number; closeDelay?: number } = {}) => {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const openTimer = React.useRef<number | null>(null);
  const closeTimer = React.useRef<number | null>(null);

  const clear = () => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };

  const enter = React.useCallback(
    (element: HTMLElement) => {
      clear();
      setAnchor(element);
      if (open) return;
      openTimer.current = window.setTimeout(() => setOpen(true), openDelay);
    },
    [open, openDelay],
  );

  const leave = React.useCallback(() => {
    clear();
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setAnchor(null);
    }, closeDelay);
  }, [closeDelay]);

  React.useEffect(() => clear, []);

  return { anchor, open, enter, leave };
};
