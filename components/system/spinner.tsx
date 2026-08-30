import { IconLoader2 } from "@tabler/icons-react";
import type React from "react";

import { cn } from "@/lib/utils";

// Inline progress, for a button that is waiting on the server.
export const Spinner = ({
  className,
  ...props
}: React.ComponentProps<"svg">) => (
  <IconLoader2
    role="status"
    aria-label="Loading"
    className={cn("size-3.5 animate-spin", className)}
    {...props}
  />
);
