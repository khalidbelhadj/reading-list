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
  if (isMobile) {
    // DrawerContent doesn't accept showCloseButton — omit it
    void showCloseButton;
    const drawerClassName = typeof className === "function" ? undefined : className;
    return <DrawerContent className={drawerClassName} {...props}>{children}</DrawerContent>;
  }
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
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const isMobile = useResponsive();
  if (isMobile) return <DrawerTitle className={className}>{children}</DrawerTitle>;
  return <DialogTitle className={className}>{children}</DialogTitle>;
}

function ResponsiveDialogDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const isMobile = useResponsive();
  if (isMobile) return <DrawerDescription className={className}>{children}</DrawerDescription>;
  return <DialogDescription className={className}>{children}</DialogDescription>;
}

function ResponsiveDialogClose({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const isMobile = useResponsive();
  if (isMobile) return <DrawerClose className={className}>{children}</DrawerClose>;
  return <DialogClose className={className}>{children}</DialogClose>;
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
