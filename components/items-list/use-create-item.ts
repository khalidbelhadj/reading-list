import React from "react";
import { useMutation } from "@tanstack/react-query";

import { createItem } from "@/app/actions";
import { findDuplicateItem } from "@/lib/url";
import { type Item } from "@/lib/types";

export type CreateArgs = {
  title: string;
  url: string;
  tagNames: string[];
  notes?: string;
  animateTitle?: boolean;
};

export type CreateCallbacks = {
  onProceed?: () => void;
  onCreated?: (itemId: string) => void;
  onOpenExisting?: (existingId: string) => void;
};

type UseCreateItemOptions = {
  // Called after a successful create when args.animateTitle is true.
  // The list view uses this to run the typing-title fetch/animate flow;
  // the new-item page leaves it unset.
  onAnimateTitle?: (itemId: string, url: string) => void | Promise<void>;
};

export const useCreateItem = (
  items: Item[] | undefined,
  { onAnimateTitle }: UseCreateItemOptions = {},
) => {
  const [duplicateDialog, setDuplicateDialog] = React.useState<{
    existing: Item;
    pending: CreateArgs;
    callbacks: CreateCallbacks;
  } | null>(null);

  // Keep the callback in a ref so the mutation doesn't churn when the
  // caller's closure identity changes.
  const onAnimateTitleRef = React.useRef(onAnimateTitle);
  onAnimateTitleRef.current = onAnimateTitle;

  const createMutation = useMutation({
    mutationFn: (args: CreateArgs) =>
      createItem(args.title, args.url, args.tagNames, undefined, args.notes),
    onSuccess: (itemId, vars) => {
      if (vars.animateTitle && itemId) {
        void onAnimateTitleRef.current?.(itemId, vars.url);
      }
    },
  });

  const requestCreate = React.useCallback(
    (args: CreateArgs, callbacks: CreateCallbacks = {}) => {
      const existing = findDuplicateItem(items, args.url);
      if (existing) {
        setDuplicateDialog({ existing, pending: args, callbacks });
        return;
      }
      callbacks.onProceed?.();
      createMutation.mutate(args, {
        onSuccess: (newId) => {
          if (newId && callbacks.onCreated) callbacks.onCreated(newId);
        },
      });
    },
    [items, createMutation],
  );

  const dismissDuplicateDialog = React.useCallback((open: boolean) => {
    if (!open) setDuplicateDialog(null);
  }, []);

  const openExisting = React.useCallback(() => {
    if (!duplicateDialog) return;
    const id = duplicateDialog.existing.id;
    duplicateDialog.callbacks.onOpenExisting?.(id);
    setDuplicateDialog(null);
  }, [duplicateDialog]);

  const createAnyway = React.useCallback(() => {
    if (!duplicateDialog) return;
    const { pending, callbacks } = duplicateDialog;
    setDuplicateDialog(null);
    callbacks.onProceed?.();
    createMutation.mutate(pending, {
      onSuccess: (newId) => {
        if (newId && callbacks.onCreated) callbacks.onCreated(newId);
      },
    });
  }, [duplicateDialog, createMutation]);

  return {
    requestCreate,
    isCreating: createMutation.isPending,
    duplicateDialog,
    dismissDuplicateDialog,
    openExisting,
    createAnyway,
  };
};
