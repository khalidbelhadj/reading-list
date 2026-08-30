import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";

import { cn } from "@/lib/utils";

// A key cap inside buttons, tooltips and menus. `on-primary` is for sitting
// inside the accent button, where the neutral fill would vanish.
const kbdVariants = cva(
  "pointer-events-none inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-[calc(var(--r-control)-5px)] px-1 font-sans text-micro font-medium select-none",
  {
    variants: {
      variant: {
        neutral: "bg-foreground/[0.07] text-muted-foreground",
        "on-primary": "bg-primary-foreground/15 text-primary-foreground/90",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export const Kbd = ({
  className,
  variant = "neutral",
  ...props
}: React.ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>) => (
  <kbd
    data-slot="kbd"
    className={cn(kbdVariants({ variant }), className)}
    {...props}
  />
);
