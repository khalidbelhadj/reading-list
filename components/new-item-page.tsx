"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IconArrowLeft } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TOOLTIP_DELAY_MS } from "@/components/ui/tooltip";
import { type Item } from "@/lib/types";
import { fetchItems } from "@/lib/queries";
import { createItem } from "@/app/actions";
import { type EditFields } from "@/components/items-list/utils";
import { useInvalidateItems } from "@/components/items-list/use-invalidate-items";
import { DetailPanel } from "@/components/items-list/detail-panel";
import { findDuplicateItem } from "@/lib/url";
import { DuplicateDialog } from "@/components/items-list/duplicate-dialog";

export const NewItemPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateItems();

  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  React.useEffect(() => {
    router.prefetch("/");
  }, [router]);

  type CreateArgs = {
    title: string;
    url: string;
    tagNames: string[];
    notes?: string;
  };

  type CreateCallbacks = {
    onProceed?: () => void;
    onCreated?: (itemId: string) => void;
    onOpenExisting?: (existingId: string) => void;
  };

  const [duplicateDialog, setDuplicateDialog] = React.useState<{
    existing: Item;
    pending: CreateArgs;
    callbacks: CreateCallbacks;
  } | null>(null);

  const createMutation = useMutation({
    mutationFn: (args: CreateArgs) =>
      createItem(args.title, args.url, args.tagNames, undefined, args.notes),
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

  const handleDuplicateOpenExisting = React.useCallback(() => {
    if (!duplicateDialog) return;
    const id = duplicateDialog.existing.id;
    duplicateDialog.callbacks.onOpenExisting?.(id);
    setDuplicateDialog(null);
  }, [duplicateDialog]);

  const handleDuplicateCreateAnyway = React.useCallback(() => {
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

  const handleDuplicateOpenChange = React.useCallback((open: boolean) => {
    if (!open) setDuplicateDialog(null);
  }, []);

  const handleCreate = React.useCallback(
    (fields: EditFields) => {
      const tagNames = fields.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (!fields.title.trim() && !fields.url.trim()) return;
      requestCreate(
        {
          title: fields.title.trim() || fields.url.trim(),
          url: fields.url.trim(),
          tagNames,
          notes: fields.notes.trim() || undefined,
        },
        {
          onCreated: async (newId) => {
            await queryClient.invalidateQueries({ queryKey: ["items"] });
            router.replace(`/item/${newId}`);
          },
          onOpenExisting: (existingId) => {
            router.push(`/item/${existingId}`);
          },
        },
      );
    },
    [requestCreate, queryClient, router],
  );

  const handleBack = React.useCallback(() => {
    router.back();
  }, [router]);

  const handleCancel = React.useCallback(() => {
    router.back();
  }, [router]);

  return (
    <div className="min-h-dvh">
      <div className="mx-auto w-full max-w-175 px-5">
        <div className="sticky top-0 z-10 flex items-center gap-0.5 -mx-1.5 pt-1.5">
          <TooltipProvider delay={TOOLTIP_DELAY_MS}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground/40"
                    onClick={handleBack}
                  />
                }
              >
                <IconArrowLeft />
              </TooltipTrigger>
              <TooltipContent>Back</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="pt-1">
          <DetailPanel
            key="new"
            item={null}
            isNew
            onSave={() => {}}
            onCreate={handleCreate}
            onCancel={handleCancel}
          />
        </div>
      </div>

      <DuplicateDialog
        open={duplicateDialog !== null}
        onOpenChange={handleDuplicateOpenChange}
        existing={duplicateDialog?.existing ?? null}
        onOpenExisting={handleDuplicateOpenExisting}
        onCreateAnyway={handleDuplicateCreateAnyway}
      />
    </div>
  );
};
