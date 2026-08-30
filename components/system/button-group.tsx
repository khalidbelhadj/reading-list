import type React from "react";

import { cn } from "@/lib/utils";

// Buttons that act as one control: a primary action with an options chevron,
// a pair of toggles. Children keep their own variant; the group joins the
// corners and separates them with a hairline of page colour.
export const ButtonGroup = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    role="group"
    data-slot="button-group"
    className={cn(
      "inline-flex w-fit items-stretch gap-px [&>[data-slot=button]]:rounded-none [&>[data-slot=button]]:focus-visible:relative [&>[data-slot=button]]:focus-visible:z-10 [&>[data-slot=button]:first-child]:rounded-l-control [&>[data-slot=button]:last-child]:rounded-r-control",
      className,
    )}
    {...props}
  />
);
