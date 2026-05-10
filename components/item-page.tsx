"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IconArrowLeft, IconDots, IconExternalLink } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { type Item } from "@/lib/types";
import { fetchItems } from "@/lib/queries";
import { updateItem, deleteItem, toggleRead } from "@/app/actions";
import { type EditFields } from "@/components/items-list/utils";
import { useInvalidateItems } from "@/components/items-list/use-invalidate-items";
import { DetailPanel } from "@/components/items-list/detail-panel";
import { DetailPanelSkeleton } from "@/components/items-list/detail-panel-skeleton";
import { ItemDropdown } from "@/components/items-list/item-dropdown";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

export const ItemPage = ({ itemId }: { itemId: string }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateItems();

  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  const item = items?.find((i) => i.id === itemId) ?? null;

  React.useEffect(() => {
    router.prefetch("/");
  }, [router]);

  React.useEffect(() => {
    const pageTitle = item?.title?.trim() || "Untitled";
    document.title = `${pageTitle} — Reading List`;
    return () => {
      document.title = "Reading List";
    };
  }, [item?.title]);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const updateMutation = useMutation({
    mutationFn: (args: {
      id: string;
      fields: {
        title?: string;
        url?: string;
        notes?: string;
        tagNames?: string[];
      };
    }) => updateItem(args.id, args.fields),
    onMutate: async ({ id, fields }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueryData<Item[]>(["items"]);
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        (old ?? []).map((it) => {
          if (it.id !== id) return it;
          const next = { ...it, updatedAt: new Date().toISOString() };
          if (fields.title !== undefined) next.title = fields.title;
          if (fields.url !== undefined) next.url = fields.url;
          if (fields.notes !== undefined) next.notes = fields.notes;
          if (fields.tagNames !== undefined) {
            const byName = new Map(it.tags.map((t) => [t.name, t]));
            next.tags = fields.tagNames.map(
              (name, i) =>
                byName.get(name) ?? { id: -(i + 1), userId: it.userId, name },
            );
          }
          return next;
        }),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(["items"], context.previous);
    },
    onSettled: invalidate,
  });

  const handleSave = React.useCallback(
    (id: string, fields: EditFields) => {
      const tagNames = fields.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      updateMutation.mutate({
        id,
        fields: {
          title: fields.title,
          url: fields.url,
          notes: fields.notes,
          tagNames,
        },
      });
    },
    [updateMutation],
  );

  const handleToggleRead = React.useCallback(async () => {
    if (!item) return;
    const newRead = !item.read;
    queryClient.setQueryData<Item[]>(["items"], (old) =>
      (old ?? []).map((it) =>
        it.id === item.id ? { ...it, read: newRead } : it,
      ),
    );
    await toggleRead(item.id, newRead);
    invalidate();
  }, [item, queryClient, invalidate]);

  const handleDelete = React.useCallback(async () => {
    if (!item) return;
    setDeleting(true);
    await deleteItem(item.id);
    invalidate();
    router.back();
  }, [item, invalidate, router]);

  const handleBack = React.useCallback(() => {
    router.back();
  }, [router]);

  return (
    <div className="min-h-dvh">
      <div className="mx-auto w-full max-w-175 px-5">
        <div className="sticky top-0 z-10 flex items-center gap-0.5 -mx-1.5 pt-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground/40"
            onClick={handleBack}
            title="Back"
          >
            <IconArrowLeft />
          </Button>
          {item?.url && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/40"
              onClick={() => window.open(item.url, "_blank")}
              title="Open URL"
            >
              <IconExternalLink />
            </Button>
          )}
          <div className="flex-1" />
          {item && (
            <ItemDropdown
              item={item}
              onToggleRead={handleToggleRead}
              onDelete={() => setDeleteOpen(true)}
            >
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground/40"
                  >
                    <IconDots />
                  </Button>
                }
              />
            </ItemDropdown>
          )}
        </div>
        <div className="pt-1">
        {!item ? (
          <DetailPanelSkeleton />
        ) : (
          <DetailPanel
            key={item.id}
            focused
            item={item}
            isNew={false}
            onSave={handleSave}
            onCreate={() => {}}
            onDelete={() => setDeleteOpen(true)}
            onToggleRead={handleToggleRead}
          />
        )}
        </div>
      </div>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
