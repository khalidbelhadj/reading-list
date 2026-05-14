"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { deleteTag, renameTag } from "@/app/actions";
import { type DbTag, type Item } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { DeleteTagDialog } from "@/components/items-list/delete-tag-dialog";

const TagBadge = ({
  tag,
  isActive,
  onToggle,
  onContextMenu,
}: {
  tag: DbTag;
  isActive: boolean;
  onToggle: (tagName: string) => void;
  onContextMenu: (tag: DbTag, el: HTMLElement) => void;
}) => {
  const handleClick = React.useCallback(() => {
    onToggle(tag.name);
  }, [onToggle, tag.name]);

  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onContextMenu(tag, e.currentTarget);
    },
    [onContextMenu, tag],
  );

  return (
    <Badge
      variant={isActive ? "default" : "secondary"}
      className="cursor-pointer"
      render={
        <button
          type="button"
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        />
      }
    >
      {tag.name}
    </Badge>
  );
};

const RenameInput = ({
  tag,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  tag: DbTag;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCommit: (tag: DbTag) => void;
  onCancel: () => void;
}) => {
  const handleBlur = React.useCallback(() => {
    onCommit(tag);
  }, [onCommit, tag]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onCommit(tag);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    },
    [onCommit, onCancel, tag],
  );

  return (
    <input
      autoFocus
      value={value}
      onChange={onChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      size={Math.max(value.length, 1)}
      className="h-5 rounded-md bg-badge px-2 text-[0.625rem] font-medium text-badge-foreground outline-none ring-1 ring-foreground/20 field-sizing-content"
    />
  );
};

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
  const [deleting, setDeleting] = React.useState(false);

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

  const confirmDelete = React.useCallback(async () => {
    if (!pendingDeleteTag) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(pendingDeleteTag.id);
    } finally {
      setDeleting(false);
      setPendingDeleteTag(null);
    }
  }, [pendingDeleteTag, deleteMutation]);

  const pendingDeleteCount = React.useMemo(() => {
    if (!pendingDeleteTag) return 0;
    return items.filter((item) =>
      item.tags.some((t) => t.id === pendingDeleteTag.id),
    ).length;
  }, [items, pendingDeleteTag]);

  const handleTagContextMenu = React.useCallback(
    (tag: DbTag, el: HTMLElement) => {
      setMenuAnchor({ tag, el });
    },
    [],
  );

  const handleRenameInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRenameDraft(e.target.value);
    },
    [],
  );

  const handleClearTags = React.useCallback(() => {
    setActiveTags(() => new Set());
  }, [setActiveTags]);

  const handleMenuOpenChange = React.useCallback((open: boolean) => {
    if (!open) setMenuAnchor(null);
  }, []);

  const handleRenameMenuClick = React.useCallback(() => {
    if (menuAnchor) startRename(menuAnchor.tag);
  }, [menuAnchor, startRename]);

  const handleDeleteMenuClick = React.useCallback(() => {
    if (menuAnchor) setPendingDeleteTag(menuAnchor.tag);
    setMenuAnchor(null);
  }, [menuAnchor]);

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {allTags.map((tag) => {
          if (renamingTagId === tag.id) {
            return (
              <RenameInput
                key={tag.id}
                tag={tag}
                value={renameDraft}
                onChange={handleRenameInputChange}
                onCommit={commitRename}
                onCancel={cancelRename}
              />
            );
          }
          const isActive = activeTags.has(tag.name);
          return (
            <TagBadge
              key={tag.id}
              tag={tag}
              isActive={isActive}
              onToggle={toggleTag}
              onContextMenu={handleTagContextMenu}
            />
          );
        })}
        {activeTags.size > 0 && (
          <Badge
            variant="ghost"
            className="cursor-pointer text-muted-foreground"
            render={<button type="button" onClick={handleClearTags} />}
          >
            clear
          </Badge>
        )}
      </div>

      <MenuPrimitive.Root
        open={menuAnchor !== null}
        onOpenChange={handleMenuOpenChange}
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
                onClick={handleRenameMenuClick}
              >
                Rename
              </MenuPrimitive.Item>
              <MenuPrimitive.Item
                data-slot="dropdown-menu-item"
                data-variant="destructive"
                className="relative flex min-h-7 cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed text-destructive outline-hidden select-none focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                onClick={handleDeleteMenuClick}
              >
                Delete
              </MenuPrimitive.Item>
            </MenuPrimitive.Popup>
          </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
      </MenuPrimitive.Root>

      <DeleteTagDialog
        tag={pendingDeleteTag}
        itemCount={pendingDeleteCount}
        deleting={deleting}
        onOpenChange={(open) => { if (!open) setPendingDeleteTag(null); }}
        onConfirm={confirmDelete}
      />
    </>
  );
};
