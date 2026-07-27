import { useMutation } from "@tanstack/react-query";
import React from "react";

import { createItem } from "@/app/actions";
import { type DuplicateItem } from "@/lib/url";

export type CreateArgs = {
  title: string;
  url: string;
  tagNames: string[];
  notes?: string;
};

export type CreateCallbacks = {
  onProceed?: () => void;
  onCreated?: (itemId: string) => void;
  onOpenExisting?: (existingId: string) => void;
  onError?: (error: Error) => void;
};

export const useCreateItem = () => {
  const [duplicateDialog, setDuplicateDialog] = React.useState<{
    existing: DuplicateItem;
    pending: CreateArgs;
    callbacks: CreateCallbacks;
  } | null>(null);

  const createMutation = useMutation({
    mutationFn: (args: CreateArgs & { allowDuplicateUrl?: boolean }) =>
      createItem(
        args.title,
        args.url,
        args.tagNames,
        undefined,
        args.notes,
        undefined,
        args.allowDuplicateUrl,
      ),
  });

  const runCreate = React.useCallback(
    (
      args: CreateArgs,
      callbacks: CreateCallbacks,
      allowDuplicateUrl: boolean,
    ) => {
      callbacks.onProceed?.();
      createMutation.mutate(
        { ...args, allowDuplicateUrl },
        {
          onSuccess: (result) => {
            if (result.ok) {
              callbacks.onCreated?.(result.itemId);
            } else {
              setDuplicateDialog({
                existing: result.duplicate,
                pending: args,
                callbacks,
              });
            }
          },
          onError: (error) => {
            callbacks.onError?.(error as Error);
          },
        },
      );
    },
    [createMutation],
  );

  const requestCreate = React.useCallback(
    (args: CreateArgs, callbacks: CreateCallbacks = {}) => {
      runCreate(args, callbacks, false);
    },
    [runCreate],
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
    runCreate(pending, callbacks, true);
  }, [duplicateDialog, runCreate]);

  return {
    requestCreate,
    isCreating: createMutation.isPending,
    duplicateDialog,
    dismissDuplicateDialog,
    openExisting,
    createAnyway,
  };
};
