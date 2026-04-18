"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { deleteTag, renameTag } from "@/app/actions";
import { type DbTag, type Item } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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

export const TagFilters = ({
  allTags,
  activeTags,
  items,
  toggleTag,
  setActiveTags,
}: {
  allTags: DbTag[];
  activeTags: Set<string>;
  items: Item[];
  toggleTag: (tagName: string) => void;
  setActiveTags: (updater: (prev: Set<string>) => Set<string>) => void;
}) => {
  const queryClient = useQueryClient();
  const [menuAnchor, setMenuAnchor] = React.useState<{
    tag: DbTag;
    el: HTMLElement;
  } | null>(null);
  const [renamingTagId, setRenamingTagId] = React.useState<number | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const [pendingDeleteTag, setPendingDeleteTag] = React.useState<DbTag | null>(
    null,
  );

  const invalidateItems = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["items"] }),
    [queryClient],
  );

  const renameMutation = useMutation({
    mutationFn: ({ tagId, newName }: { tagId: number; newName: string }) =>
      renameTag(tagId, newName),
    onMutate: async ({ tagId, newName }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueryData<Item[]>(["items"]);
      queryClient.setQueryData<Item[]>(["items"], (old) =>
        (old ?? []).map((item) => ({
          ...item,
          tags: item.tags.map((t) =>
            t.id === tagId ? { ...t, name: newName } : t,
          ),
        })),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["items"], context.previous);
      }
    },
    onSettled: invalidateItems,
  });

  const deleteMutation = useMutation({
    mutationFn: (tagId: number) => deleteTag(tagId),
    onSuccess: invalidateItems,
  });

  const startRename = React.useCallback((tag: DbTag) => {
    setRenamingTagId(tag.id);
    setRenameDraft(tag.name);
    setMenuAnchor(null);
  }, []);

  const commitRename = React.useCallback(
    (tag: DbTag) => {
      const next = renameDraft.trim().toLowerCase();
      setRenamingTagId(null);
      if (next && next !== tag.name) {
        renameMutation.mutate({ tagId: tag.id, newName: next });
      }
    },
    [renameDraft, renameMutation],
  );

  const cancelRename = React.useCallback(() => {
    setRenamingTagId(null);
  }, []);

  const confirmDelete = React.useCallback(() => {
    if (!pendingDeleteTag) return;
    deleteMutation.mutate(pendingDeleteTag.id);
    setPendingDeleteTag(null);
  }, [pendingDeleteTag, deleteMutation]);

  const pendingDeleteCount = React.useMemo(() => {
    if (!pendingDeleteTag) return 0;
    return items.filter((item) =>
      item.tags.some((t) => t.id === pendingDeleteTag.id),
    ).length;
  }, [items, pendingDeleteTag]);

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {allTags.map((tag) => {
          const isActive = activeTags.has(tag.name);
          if (renamingTagId === tag.id) {
            return (
              <input
                key={tag.id}
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => commitRename(tag)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    commitRename(tag);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    cancelRename();
                  }
                }}
                className="h-5 rounded-md bg-badge px-2 text-xs text-badge-foreground outline-none ring-1 ring-foreground/20 min-w-16"
              />
            );
          }
          return (
            <Badge
              key={tag.id}
              variant={isActive ? "default" : "secondary"}
              className="cursor-pointer"
              render={
                <button
                  type="button"
                  onClick={() => toggleTag(tag.name)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenuAnchor({
                      tag,
                      el: e.currentTarget as HTMLElement,
                    });
                  }}
                />
              }
            >
              {tag.name}
            </Badge>
          );
        })}
        {activeTags.size > 0 && (
          <Badge
            variant="ghost"
            className="cursor-pointer text-muted-foreground"
            render={
              <button
                type="button"
                onClick={() => setActiveTags(() => new Set())}
              />
            }
          >
            clear
          </Badge>
        )}
      </div>

      <MenuPrimitive.Root
        open={menuAnchor !== null}
        onOpenChange={(open) => {
          if (!open) setMenuAnchor(null);
        }}
      >
        <MenuPrimitive.Portal>
          <MenuPrimitive.Positioner
            anchor={menuAnchor?.el ?? null}
            className="isolate z-50 outline-none"
            align="start"
            sideOffset={4}
          >
            <MenuPrimitive.Popup
              data-slot="dropdown-menu-content"
              className="z-50 min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
            >
              <MenuPrimitive.Item
                data-slot="dropdown-menu-item"
                className="relative flex min-h-7 cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed outline-hidden select-none focus:bg-accent focus:text-accent-foreground"
                onClick={() => {
                  if (menuAnchor) startRename(menuAnchor.tag);
                }}
              >
                Rename
              </MenuPrimitive.Item>
              <MenuPrimitive.Item
                data-slot="dropdown-menu-item"
                data-variant="destructive"
                className="relative flex min-h-7 cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed text-destructive outline-hidden select-none focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                onClick={() => {
                  if (menuAnchor) setPendingDeleteTag(menuAnchor.tag);
                  setMenuAnchor(null);
                }}
              >
                Delete
              </MenuPrimitive.Item>
            </MenuPrimitive.Popup>
          </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
      </MenuPrimitive.Root>

      <AlertDialog
        open={pendingDeleteTag !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteTag(null);
        }}
      >
        <AlertDialogContent
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              confirmDelete();
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteTag && (
                <>
                  This will remove{" "}
                  <span className="font-medium">{pendingDeleteTag.name}</span>{" "}
                  from {pendingDeleteCount}{" "}
                  {pendingDeleteCount === 1 ? "item" : "items"}.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
