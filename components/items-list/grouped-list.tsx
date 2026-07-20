import { IconChevronRight, IconPencil, IconTrash } from "@tabler/icons-react";
import React from "react";

import { DeleteTagDialog } from "@/components/items-list/delete-tag-dialog";
import { TagRenameInput } from "@/components/items-list/tag-rename-input";
import { useTagMutations } from "@/components/items-list/use-tag-mutations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { type ItemGroup } from "./use-filters";
import { VirtualItemGroup } from "./virtual-item-group";

type GroupedListProps = {
  groups: ItemGroup[];
  items: Item[];
};

export const GroupedList = ({ groups, items }: GroupedListProps) => {
  const [openKeys, setOpenKeys] = React.useState<Set<string>>(() => new Set());
  const [closedDateKeys, setClosedDateKeys] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [contextMenuOpenTagId, setContextMenuOpenTagId] = React.useState<
    number | null
  >(null);

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

  const toggle = React.useCallback((key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleDateGroup = React.useCallback((key: string) => {
    setClosedDateKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <>
      <div className="flex flex-col">
        {groups.map((group) => {
          const isOpen = openKeys.has(group.key);
          const isTagGroup = group.key.startsWith("tag:");
          const isUntagged = group.key === "tag:__untagged__";
          const tagForGroup =
            isTagGroup && !isUntagged
              ? (group.items[0]?.tags.find((t) => t.name === group.label) ??
                null)
              : null;
          const isRenaming = tagForGroup && renamingTagId === tagForGroup.id;
          const isContextMenuOpen =
            tagForGroup && contextMenuOpenTagId === tagForGroup.id;
          const headerButton = (
            <Button
              variant="ghost"
              onClick={() => toggle(group.key)}
              className={cn(
                "flex h-auto w-full items-center justify-start gap-1.5 rounded-lg p-1 text-left font-content text-sm outline-none hover:bg-muted",
                isContextMenuOpen && "bg-muted",
              )}
            >
              <IconChevronRight
                className={cn(
                  "size-3.5 text-muted-foreground transition-transform duration-100",
                  isOpen && "rotate-90",
                )}
              />
              {isTagGroup && !isUntagged ? (
                isRenaming && tagForGroup ? (
                  <TagRenameInput
                    tag={tagForGroup}
                    value={renameDraft}
                    onChange={setRenameDraft}
                    onCommit={commitRename}
                    onCancel={cancelRename}
                    stopClickPropagation
                  />
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    {group.label}
                  </Badge>
                )
              ) : (
                <span className="truncate">{group.label}</span>
              )}
              <span className="ml-1 text-xs text-muted-foreground">
                {group.items.length}
              </span>
            </Button>
          );
          const headerNode = isTagGroup ? (
            tagForGroup ? (
              <ContextMenu
                onOpenChange={(open) =>
                  setContextMenuOpenTagId(open ? tagForGroup.id : null)
                }
              >
                <ContextMenuTrigger render={<div />}>
                  {headerButton}
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => startRename(tagForGroup)}>
                    <IconPencil />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() => setPendingDeleteTag(tagForGroup)}
                  >
                    <IconTrash />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ) : (
              headerButton
            )
          ) : (
            <button
              type="button"
              onClick={() => toggleDateGroup(group.key)}
              className="inline-flex items-center gap-1 px-1 pb-0.5 text-xs text-muted-foreground transition-colors outline-none select-none hover:text-foreground"
            >
              {group.label}
              <IconChevronRight
                className={cn(
                  "size-3 transition-transform duration-150",
                  !closedDateKeys.has(group.key) && "rotate-90",
                )}
              />
            </button>
          );
          return (
            <div
              key={group.key}
              className={cn(!isTagGroup && "mt-4 first:mt-0")}
            >
              <VirtualItemGroup
                header={headerNode}
                open={isTagGroup ? isOpen : !closedDateKeys.has(group.key)}
                items={group.items}
              />
            </div>
          );
        })}
      </div>

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
