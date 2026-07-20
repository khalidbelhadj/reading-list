import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Popover = ({ ...props }: PopoverPrimitive.Root.Props) => {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
};

const PopoverTrigger = ({ ...props }: PopoverPrimitive.Trigger.Props) => {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
};

const PopoverContent = ({
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 8,
  className,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) => {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          // Mirrors alert-dialog content (rounded-xl bg-popover p-4 shadow ring)
          // so a popover reads as the same surface as the modal, just anchored.
          className={cn(
            "z-50 grid w-80 origin-(--transform-origin) gap-3 rounded-xl bg-popover p-4 text-popover-foreground shadow-depth-elevated ring-1 ring-foreground/10 duration-75 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
};

const PopoverHeader = ({
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="popover-header"
      className={cn("grid gap-1", className)}
      {...props}
    />
  );
};

const PopoverFooter = ({
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="popover-footer"
      className={cn("flex flex-row justify-end gap-2", className)}
      {...props}
    />
  );
};

const PopoverTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Title>) => {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );
};

const PopoverDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Description>) => {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn(
        "text-xs/relaxed text-balance text-muted-foreground md:text-pretty",
        className,
      )}
      {...props}
    />
  );
};

const PopoverClose = ({
  className,
  variant = "outline",
  size = "default",
  ...props
}: PopoverPrimitive.Close.Props &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) => {
  return (
    <PopoverPrimitive.Close
      data-slot="popover-close"
      className={cn(className)}
      render={<Button variant={variant} size={size} />}
      {...props}
    />
  );
};

export {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverFooter,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
