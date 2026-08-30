import type React from "react";

import { cn } from "@/lib/utils";

// A placeholder block the shape of what is loading. Size it with className.
export const Skeleton = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="skeleton"
    className={cn(
      "animate-pulse rounded-control bg-foreground/[0.06]",
      className,
    )}
    {...props}
  />
);
