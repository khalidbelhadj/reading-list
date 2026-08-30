import type React from "react";

import { cn } from "@/lib/utils";

// Multi-line text. Same surface as Input; grows with `rows`, never with a
// drag handle (resize is off so layouts stay put).
export const Textarea = ({
  className,
  ...props
}: React.ComponentProps<"textarea">) => (
  <textarea
    data-slot="textarea"
    className={cn(
      "w-full min-w-0 resize-none rounded-control bg-foreground/[0.05] px-2.5 py-2 text-body text-foreground outline-none placeholder:text-muted-foreground hover:bg-foreground/[0.07] focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/40",
      className,
    )}
    {...props}
  />
);
