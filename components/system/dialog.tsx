import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type React from "react";

import { cn } from "@/lib/utils";

// A modal for decisions that need the whole screen's attention: destructive// confirmations, multi-field forms. Opaque surface; no dimmed backdrop (a
// tint over the translucent sidebar reads as a glitch). No
// close button in the corner; the actions row always offers a way out.

export const Dialog = (props: DialogPrimitive.Root.Props) => (
  <DialogPrimitive.Root {...props} />
);

export const DialogTrigger = (props: DialogPrimitive.Trigger.Props) => (
  <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
);

export const DialogClose = (props: DialogPrimitive.Close.Props) => (
  <DialogPrimitive.Close data-slot="dialog-close" {...props} />
);

export const DialogContent = ({
  className,
  ...props
}: DialogPrimitive.Popup.Props) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Backdrop className="fixed inset-0 z-50" />
    <DialogPrimitive.Popup
      data-slot="dialog-content"
      className={cn(
        "fixed top-1/2 left-1/2 z-50 flex w-[min(24rem,calc(100vw-2rem))] -translate-1/2 flex-col gap-3 rounded-surface bg-card p-6 text-foreground shadow-surface transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
        className,
      )}
      {...props}
    />
  </DialogPrimitive.Portal>
);

export const DialogTitle = ({
  className,
  ...props
}: DialogPrimitive.Title.Props) => (
  <DialogPrimitive.Title
    data-slot="dialog-title"
    className={cn(
      "font-content text-heading font-semibold tracking-tight",
      className,
    )}
    {...props}
  />
);

export const DialogDescription = ({
  className,
  ...props
}: DialogPrimitive.Description.Props) => (
  <DialogPrimitive.Description
    data-slot="dialog-description"
    className={cn("text-body text-muted-foreground", className)}
    {...props}
  />
);

export const DialogActions = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="dialog-actions"
    className={cn("flex justify-end gap-2 pt-3", className)}
    {...props}
  />
);
