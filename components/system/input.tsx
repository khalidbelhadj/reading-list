import { Input as InputPrimitive } from "@base-ui/react/input";
import type React from "react";

import { cn } from "@/lib/utils";

// Text field. A quiet fill at rest and while focused — the caret is the
// focus indicator, no ring. `leading` and `trailing` put an icon, a key cap
// or a short label inside the field on either side; they are decorative, so
// the field itself stays the target.
export const Input = ({
  leading,
  trailing,
  className,
  ...props
}: React.ComponentProps<"input"> & {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) => (
  <div
    data-slot="input"
    className={cn(
      "flex h-7 w-full min-w-0 items-center gap-2 rounded-control bg-foreground/[0.05] px-2.5 text-body text-foreground hover:bg-foreground/[0.07] has-disabled:pointer-events-none has-disabled:opacity-50 has-aria-invalid:ring-2 has-aria-invalid:ring-destructive/40",
      className,
    )}
  >
    {leading && (
      <span className="flex shrink-0 items-center text-muted-foreground [&>svg]:size-3.5">
        {leading}
      </span>
    )}
    <InputPrimitive
      className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
      {...props}
    />
    {trailing && (
      <span className="flex shrink-0 items-center text-muted-foreground [&>svg]:size-3.5">
        {trailing}
      </span>
    )}
  </div>
);
