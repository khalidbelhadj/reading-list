"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconArrowLeft } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { type Item } from "@/lib/types";
import { fetchItems } from "@/lib/queries";
import { type EditFields } from "@/components/items-list/utils";
import { DetailPanel } from "@/components/items-list/detail-panel";
import { DuplicateDialog } from "@/components/items-list/duplicate-dialog";
import { useCreateItem } from "@/components/items-list/use-create-item";

export const NewItemPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
    staleTime: Infinity,
  });

  React.useEffect(() => {
    router.prefetch("/");
  }, [router]);

  const {
    requestCreate,
    isCreating,
    duplicateDialog,
    dismissDuplicateDialog,
    openExisting,
    createAnyway,
  } = useCreateItem(items);

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
        </div>
        <div className="pt-1">
          <DetailPanel
            key="new"
            item={null}
            isNew
            onSave={() => {}}
            onCreate={handleCreate}
            onCancel={handleCancel}
            isSaving={isCreating}
          />
        </div>
      </div>

      <DuplicateDialog
        open={duplicateDialog !== null}
        onOpenChange={dismissDuplicateDialog}
        existing={duplicateDialog?.existing ?? null}
        onOpenExisting={openExisting}
        onCreateAnyway={createAnyway}
      />
    </div>
  );
};
