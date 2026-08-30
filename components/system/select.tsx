import { Select as SelectPrimitive } from "@base-ui/react/select";
import { IconCheck, IconSelector } from "@tabler/icons-react";
import type React from "react";

import { cn } from "@/lib/utils";

export type SelectItem<T extends string> = {
  value: T;
  label: React.ReactNode;
  // A faint line under the label explaining the choice. Only the label shows
  // in the trigger.
  description?: React.ReactNode;
};

// One-of-many in a popup. The trigger looks like an Input; the popup is a
// frost surface dropped beneath it. Values are strings; the label is whatever
// renders.
export const Select = <T extends string>({
  value,
  onValueChange,
  items,
  placeholder = "Choose",
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  value: T | null;
  onValueChange: (value: T) => void;
  items: SelectItem<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) => (
  <SelectPrimitive.Root<T>
    value={value}
    onValueChange={(next) => {
      if (next !== null) onValueChange(next);
    }}
    items={items}
    disabled={disabled}
  >
    <SelectPrimitive.Trigger
      aria-label={ariaLabel}
      className={cn(
        "flex h-7 w-full min-w-0 items-center justify-between gap-2 rounded-control bg-foreground/[0.05] px-2.5 text-body text-foreground outline-none select-none hover:bg-foreground/[0.07] focus-visible:ring-2 focus-visible:ring-ring/40 data-[placeholder]:text-muted-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
    >
      <SelectPrimitive.Value placeholder={placeholder} className="truncate" />
      <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
        <IconSelector className="size-3.5" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        // Drop below the trigger like a menu, rather than sliding the chosen
        // item over it: the popup is its own surface, not an extension of the
        // control.
        alignItemWithTrigger={false}
        sideOffset={4}
        className="z-50 outline-none"
      >
        <SelectPrimitive.Popup className="glass min-w-(--anchor-width) origin-(--transform-origin) rounded-control p-1 text-foreground transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
          {items.map((item) => (
            <SelectPrimitive.Item
              key={item.value}
              value={item.value}
              className={cn(
                "relative flex cursor-default items-center gap-2 rounded-[calc(var(--r-control)-3px)] pr-2 pl-7 text-body outline-none select-none data-highlighted:bg-foreground/[0.06] data-disabled:opacity-50",
                item.description ? "py-1" : "h-7",
              )}
            >
              <SelectPrimitive.ItemIndicator
                className={cn(
                  "absolute left-1.5 flex items-center",
                  item.description ? "top-[7px]" : "inset-y-0",
                )}
              >
                <IconCheck className="size-3" stroke={2.5} />
              </SelectPrimitive.ItemIndicator>
              <span className="flex min-w-0 flex-col">
                <SelectPrimitive.ItemText>
                  {item.label}
                </SelectPrimitive.ItemText>
                {item.description && (
                  <span className="text-micro text-muted-foreground/80">
                    {item.description}
                  </span>
                )}
              </span>
            </SelectPrimitive.Item>
          ))}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
);
