import { motion } from "motion/react";
import React from "react";

// Shared pill geometry. Padding and gap are identical between states so only
// the label width animates when an item activates/deactivates — no jump.
export const NAV_ITEM_BASE =
  "flex h-6 items-center gap-1 rounded-full px-2 font-content text-xs/relaxed font-medium outline-none select-none";
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
// animation. The negative margin cancels the container gap while collapsed.
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
  const collapsed = { width: 0, marginLeft: -4 };
  const expanded = { width: "auto", marginLeft: 0 } as const;
  return (
    <motion.span
      initial={animate ? (wasActive ? expanded : collapsed) : false}
      animate={show ? expanded : collapsed}
      transition={{ type: "tween", duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-hidden whitespace-nowrap"
    >
      {children}
    </motion.span>
  );
};
