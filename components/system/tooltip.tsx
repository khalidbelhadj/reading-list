import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type React from "react";

import { cn } from "@/lib/utils";

// Shared hover-hold delay (ms) before a tooltip appears. Applied app-wide by
// the provider below, mounted once in the root route.
const TOOLTIP_DELAY_MS = 500;

export const TooltipProvider = ({
  delay = TOOLTIP_DELAY_MS,
  ...props
}: TooltipPrimitive.Provider.Props) => (
  <TooltipPrimitive.Provider delay={delay} {...props} />
);

// Hover hint on a single element. Deliberately flat: a solid fill, no
// hairline, no blur, so it reads as a label and not as another surface. The
// delay comes from the app-wide provider mounted in the root route.
export const Tooltip = ({
  content,
  side = "top",
  sideOffset = 6,
  open,
  className,
  children,
}: {
  content: React.ReactNode;
  // Force the tooltip open (a "Copied" confirmation); omit for hover.
  open?: boolean;
  side?: TooltipPrimitive.Positioner.Props["side"];
  sideOffset?: number;
  className?: string;
  // The trigger element. Props are merged onto it; it must accept a ref.
  children: React.ReactElement;
}) => (
  <TooltipPrimitive.Root open={open}>
    <TooltipPrimitive.Trigger render={children} />
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        className="z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip"
          className={cn(
            "inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-[calc(var(--r-control)-2px)] bg-secondary px-2 py-1 text-small text-secondary-foreground transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] select-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
            className,
          )}
        >
          {content}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
);
