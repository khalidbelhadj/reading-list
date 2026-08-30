import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

// On/off. The track takes the accent when on; the thumb is always the page
// colour so it reads as a physical control rather than a coloured pill.
export const Switch = ({ className, ...props }: SwitchPrimitive.Root.Props) => (
  <SwitchPrimitive.Root
    data-slot="switch"
    className={cn(
      "group/switch relative inline-flex h-4.5 w-7.5 shrink-0 items-center rounded-full p-0.5 outline-none after:absolute after:-inset-x-2 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-ring/40 data-checked:bg-primary data-unchecked:bg-foreground/[0.14] data-disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      data-slot="switch-thumb"
      className="pointer-events-none block size-3.5 rounded-full bg-background shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] data-checked:translate-x-3 data-unchecked:translate-x-0"
    />
  </SwitchPrimitive.Root>
);
