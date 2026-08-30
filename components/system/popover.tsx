import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type React from "react";

import { cn } from "@/lib/utils";

// A small anchored surface for a quick confirm or a compact form. Frost,
// like menus; anything that needs the user's full attention is a Dialog.

export const Popover = (props: PopoverPrimitive.Root.Props) => (
  <PopoverPrimitive.Root {...props} />
);

export const PopoverTrigger = (props: PopoverPrimitive.Trigger.Props) => (
  <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
);

export const PopoverClose = (props: PopoverPrimitive.Close.Props) => (
  <PopoverPrimitive.Close data-slot="popover-close" {...props} />
);

export const PopoverContent = ({
  align = "center",
  side = "bottom",
  sideOffset = 6,
  className,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, "align" | "side" | "sideOffset">) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Positioner
      align={align}
      side={side}
      sideOffset={sideOffset}
      className="z-50 outline-none"
    >
      <PopoverPrimitive.Popup
        data-slot="popover-content"
        className={cn(
          "glass flex w-72 origin-(--transform-origin) flex-col gap-3 rounded-[14px] p-4 text-foreground transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
);

export const PopoverTitle = ({
  className,
  ...props
}: PopoverPrimitive.Title.Props) => (
  <PopoverPrimitive.Title
    data-slot="popover-title"
    className={cn("font-content text-title font-medium", className)}
    {...props}
  />
);

export const PopoverDescription = ({
  className,
  ...props
}: PopoverPrimitive.Description.Props) => (
  <PopoverPrimitive.Description
    data-slot="popover-description"
    className={cn("text-body text-muted-foreground", className)}
    {...props}
  />
);

export const PopoverActions = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="popover-actions"
    className={cn("flex justify-end gap-2 pt-1", className)}
    {...props}
  />
);
