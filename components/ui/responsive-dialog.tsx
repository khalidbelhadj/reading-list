/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import useIsMobile from "@/lib/use-is-mobile";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const ResponsiveContext = React.createContext(false);

function useResponsive() {
  return React.useContext(ResponsiveContext);
}

function ResponsiveDialog({
  children,
  ...props
}: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) {
  const { isMobile } = useIsMobile();
  return (
    <ResponsiveContext.Provider value={isMobile}>
      {isMobile ? <Drawer {...props}>{children}</Drawer> : <Dialog {...props}>{children}</Dialog>}
    </ResponsiveContext.Provider>
  );
}

function ResponsiveDialogContent({
  children,
  className,
  showCloseButton,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isMobile = useResponsive();
  if (isMobile) return <DrawerContent className={className} {...(props as any)}>{children}</DrawerContent>;
  return <DialogContent className={className} showCloseButton={showCloseButton} {...props}>{children}</DialogContent>;
}

function ResponsiveDialogHeader({ children, ...props }: React.ComponentProps<"div">) {
  const isMobile = useResponsive();
  if (isMobile) return <DrawerHeader {...props}>{children}</DrawerHeader>;
  return <DialogHeader {...props}>{children}</DialogHeader>;
}

function ResponsiveDialogFooter({ children, ...props }: React.ComponentProps<"div">) {
  const isMobile = useResponsive();
  if (isMobile) return <DrawerFooter {...props}>{children}</DrawerFooter>;
  return <DialogFooter {...props}>{children}</DialogFooter>;
}

function ResponsiveDialogTitle({
  children,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = useResponsive();
  if (isMobile) return <DrawerTitle {...(props as any)}>{children}</DrawerTitle>;
  return <DialogTitle {...props}>{children}</DialogTitle>;
}

function ResponsiveDialogDescription({
  children,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = useResponsive();
  if (isMobile) return <DrawerDescription {...(props as any)}>{children}</DrawerDescription>;
  return <DialogDescription {...props}>{children}</DialogDescription>;
}

function ResponsiveDialogClose({
  children,
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const isMobile = useResponsive();
  if (isMobile) return <DrawerClose {...(props as any)}>{children}</DrawerClose>;
  return <DialogClose {...props}>{children}</DialogClose>;
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogClose,
};
