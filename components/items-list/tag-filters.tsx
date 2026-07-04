import React from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { type DbTag, type Item } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { DeleteTagDialog } from "@/components/items-list/delete-tag-dialog";
import { TagRenameInput } from "@/components/items-list/tag-rename-input";
import { useTagMutations } from "@/components/items-list/use-tag-mutations";

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
  const {
    renamingTagId,
    renameDraft,
    setRenameDraft,
    startRename,
    commitRename,
    cancelRename,
    pendingDeleteTag,
    setPendingDeleteTag,
    pendingDeleteCount,
    confirmDelete,
    deleting,
  } = useTagMutations(items);

  const [menuAnchor, setMenuAnchor] = React.useState<{
    tag: DbTag;
    el: HTMLElement;
  } | null>(null);

  const handleTagContextMenu = React.useCallback(
    (tag: DbTag, el: HTMLElement) => {
      setMenuAnchor({ tag, el });
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
    if (menuAnchor) {
      startRename(menuAnchor.tag);
      setMenuAnchor(null);
    }
  }, [menuAnchor, startRename]);

  const handleDeleteMenuClick = React.useCallback(() => {
    if (menuAnchor) setPendingDeleteTag(menuAnchor.tag);
    setMenuAnchor(null);
  }, [menuAnchor, setPendingDeleteTag]);

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {allTags.map((tag) => {
          if (renamingTagId === tag.id) {
            return (
              <TagRenameInput
                key={tag.id}
                tag={tag}
                value={renameDraft}
                onChange={setRenameDraft}
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
              className="z-50 min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-depth-floating ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
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
        onOpenChange={(open) => {
          if (!open) setPendingDeleteTag(null);
        }}
        onConfirm={confirmDelete}
      />
    </>
  );
};
