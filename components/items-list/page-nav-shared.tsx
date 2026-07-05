import { motion } from "motion/react";
import React from "react";

// Shared pill geometry. The icon↔label spacing lives in the label's own
// padding (not a container `gap`) so a collapsing label carries its spacing
// with it — the pill closes cleanly over the text with nothing left to cancel.
export const NAV_ITEM_BASE =
  "flex h-6 items-center rounded-full px-2 font-content text-xs/relaxed font-medium outline-none select-none";
export const NAV_ITEM_ACTIVE = "bg-muted";
export const NAV_ITEM_INACTIVE =
  "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

// Cross-navigation hand-off. A nav click records the route we're leaving so the
// destination page can replay the *previous* item collapsing while the new one
// expands. It survives client navigation (module scope), but not a full reload —
// so a refresh / direct load animates nothing.
let pendingFrom: string | null = null;

export const markNavFrom = (path: string) => {
  pendingFrom = path;
};

// Returns the route we navigated from — but only on the first render after a
// nav click, and only for a client navigation (null on fresh load, refresh, or
// back/forward). Reads module state during render without mutating it, so it is
// safe under React StrictMode's double-invoke.
export const useNavFrom = (): string | null => {
  const [from] = React.useState(() => pendingFrom);
  React.useEffect(() => {
    pendingFrom = null;
  }, []);
  return from;
};

// A label that grows out of / collapses into its icon. `show` is the current
// active state; when `from` is set (a client navigation) the label animates
// from `wasActive`'s state, otherwise it mounts at its final size with no
// animation. Only the width animates — the text stays anchored to the left
// (its `pl-1` spacing collapses with it) so the pill closes over stationary
// text rather than sliding it.
export const NavLabel = ({
  children,
  show,
  wasActive,
  animate,
}: {
  children: React.ReactNode;
  show: boolean;
  wasActive: boolean;
  animate: boolean;
}) => {
  const collapsed = { width: 0 };
  const expanded = { width: "auto" } as const;
  return (
    // Outer element owns the animated width and clips; it carries no padding so
    // width:0 is truly zero (border-box can't shrink an element below its own
    // padding, so a padded outer would leave a residual sliver when collapsed).
    // The inner span holds the icon↔label spacing and gets clipped away with the
    // text, keeping the text anchored left as the pill closes over it.
    <motion.span
      initial={animate ? (wasActive ? expanded : collapsed) : false}
      animate={show ? expanded : collapsed}
      transition={{ type: "tween", duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-hidden"
    >
      <span className="block pl-1 whitespace-nowrap">{children}</span>
    </motion.span>
  );
};
