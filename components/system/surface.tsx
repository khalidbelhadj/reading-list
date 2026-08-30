import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";

import { cn } from "@/lib/utils";

// The two kinds of surface the system has: opaque (cards, popovers, dialogs)
// and frost (sidebars, floating panels over content or wallpaper). There is
// no third kind; if something needs one, the answer is a different layout.
const surfaceVariants = cva("rounded-surface text-foreground", {
  variants: {
    kind: {
      opaque: "bg-card shadow-surface",
      frost: "glass",
    },
    padding: {
      none: "",
      sm: "p-3",
      md: "p-5",
      lg: "p-7",
    },
  },
  defaultVariants: {
    kind: "opaque",
    padding: "md",
  },
});

export const Surface = ({
  className,
  kind = "opaque",
  padding = "md",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof surfaceVariants>) => (
  <div
    data-slot="surface"
    className={cn(surfaceVariants({ kind, padding, className }))}
    {...props}
  />
);
