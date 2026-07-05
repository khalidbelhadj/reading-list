import React from "react";

/**
 * Height-animated container. Measures its content and transitions between
 * `0px` and the natural height so sections expand/collapse smoothly, then
 * clears the inline height so the content can reflow freely while open.
 */
export const CollapsibleSection = ({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) => {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const prevOpen = React.useRef(open);

  React.useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    // Open state unchanged across this render (content changed, not the
    // toggle) — keep the height pinned without re-running the transition.
    if (prevOpen.current === open) {
      outer.style.height = open ? "" : "0px";
      return;
    }
    prevOpen.current = open;

    const h = inner.scrollHeight;

    // Force the start height with transitions off, flush layout, then re-enable
    // transitions and set the target so the browser animates between the two.
    outer.style.transition = "none";
    outer.style.height = open ? "0px" : `${h}px`;
    outer.getBoundingClientRect();
    outer.style.transition = "";
    outer.style.height = open ? `${h}px` : "0px";

    if (open) {
      // Once expanded, drop the fixed height so nested content can grow/shrink.
      const onEnd = () => {
        outer.style.height = "";
        outer.removeEventListener("transitionend", onEnd);
      };
      outer.addEventListener("transitionend", onEnd);
      return () => outer.removeEventListener("transitionend", onEnd);
    }
  }, [open]);

  return (
    <div
      ref={outerRef}
      className="overflow-hidden transition-[height] duration-250 ease-in-out"
    >
      <div ref={innerRef} className="space-y-px">
        {children}
      </div>
    </div>
  );
};
