"use client";

import React from "react";
import Image from "next/image";
import { IconFileFilled } from "@tabler/icons-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type DuplicateItem } from "@/lib/url";
import { getFaviconSrc } from "./utils";

export const DuplicateDialog = ({
  open,
  onOpenChange,
  existing,
  onOpenExisting,
  onCreateAnyway,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: DuplicateItem | null;
  onOpenExisting: () => void;
  onCreateAnyway: () => void;
}) => {
  const faviconSrc = existing ? getFaviconSrc(existing) : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Item already exists</AlertDialogTitle>
          <AlertDialogDescription>
            An item with this URL is already in your list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {existing && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs min-w-0 overflow-hidden">
            <div className="size-4 shrink-0 flex items-center justify-center">
              {faviconSrc ? (
                <Image
                  src={faviconSrc}
                  alt=""
                  width={16}
                  height={16}
                  className="rounded-sm"
                  unoptimized
                />
              ) : (
                <IconFileFilled className="size-3 text-muted-foreground" />
              )}
            </div>
            <span className="truncate">{existing.title || existing.url}</span>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="outline" onClick={onCreateAnyway}>
            Create anyway
          </AlertDialogAction>
          <AlertDialogAction onClick={onOpenExisting}>
            Open existing
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
