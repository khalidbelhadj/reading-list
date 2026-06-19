"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const AlertDialog = ({ ...props }: AlertDialogPrimitive.Root.Props) => {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
};

const AlertDialogTrigger = ({
  ...props
}: AlertDialogPrimitive.Trigger.Props) => {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
};

const AlertDialogPortal = ({ ...props }: AlertDialogPrimitive.Portal.Props) => {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  );
};

const AlertDialogOverlay = ({
  className,
  ...props
}: AlertDialogPrimitive.Backdrop.Props) => {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 duration-75 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
};

const AlertDialogContent = ({
  className,
  size = "default",
  ...props
}: AlertDialogPrimitive.Popup.Props & {
  size?: "default" | "sm";
}) => {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
        <AlertDialogPrimitive.Popup
          data-slot="alert-dialog-content"
          data-size={size}
          className={cn(
            "pointer-events-auto grid w-full max-w-sm gap-3 rounded-xl bg-popover p-4 text-popover-foreground shadow-depth-elevated ring-1 ring-foreground/10 duration-75 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        />
      </div>
    </AlertDialogPortal>
  );
};

const AlertDialogHeader = ({
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] gap-1 has-data-[slot=alert-dialog-media]:gap-x-4",
        className,
      )}
      {...props}
    />
  );
};

const AlertDialogFooter = ({
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn("flex flex-row justify-end gap-2", className)}
      {...props}
    />
  );
};

const AlertDialogMedia = ({
  className,
  ...props
}: React.ComponentProps<"div">) => {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-8 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
};

const AlertDialogTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) => {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "text-sm font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className,
      )}
      {...props}
    />
  );
};

const AlertDialogDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) => {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        "text-xs/relaxed text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
};

const AlertDialogAction = ({
  className,
  ...props
}: React.ComponentProps<typeof Button>) => {
  return (
    <Button
      data-slot="alert-dialog-action"
      className={cn(className)}
      {...props}
    />
  );
};

const AlertDialogCancel = ({
  className,
  variant = "outline",
  size = "default",
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) => {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      className={cn(className)}
      render={<Button variant={variant} size={size} />}
      {...props}
    />
  );
};

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
