import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { IconCheck } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

// A box that fills with the accent when checked. Sized to sit on a 24px row.
export const Checkbox = ({
  className,
  ...props
}: CheckboxPrimitive.Root.Props) => (
  <CheckboxPrimitive.Root
    data-slot="checkbox"
    className={cn(
      "group/checkbox flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-foreground/[0.08] text-primary-foreground outline-none after:absolute after:-inset-2 focus-visible:ring-2 focus-visible:ring-ring/40 data-indeterminate:bg-primary data-checked:bg-primary data-disabled:opacity-50",
      "relative",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      data-slot="checkbox-indicator"
      className="grid place-content-center"
    >
      <IconCheck
        className="size-3 group-data-indeterminate/checkbox:hidden"
        stroke={3}
      />
      <span className="hidden h-0.5 w-2 rounded-full bg-current group-data-indeterminate/checkbox:block" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);
