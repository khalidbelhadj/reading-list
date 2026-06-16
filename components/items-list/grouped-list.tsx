import { IconChevronRight, IconPencil, IconTrash } from "@tabler/icons-react";
import React from "react";

import { DeleteTagDialog } from "@/components/items-list/delete-tag-dialog";
import { TagRenameInput } from "@/components/items-list/tag-rename-input";
import { useTagMutations } from "@/components/items-list/use-tag-mutations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { CollapsibleSection } from "./collapsible-section";
import { ItemRow } from "./item-row";
import { type ItemGroup } from "./use-filters";
import { resolveRowItem, type Density } from "./utils";

type GroupedListProps = {
  groups: ItemGroup[];
  items: Item[];
  typingTitles: Record<string, string>;
  suppressHover: boolean;
  density?: Density;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleRead: (id: string, read: boolean) => void;
  onTogglePin: (id: string, starred: boolean) => void;
};

export const GroupedList = ({
  groups,
  items,
  typingTitles,
  suppressHover,
  density = "compact",
  onSelect,
  onDelete,
  onToggleRead,
  onTogglePin,
}: GroupedListProps) => {
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
                "flex items-center gap-1.5 p-1 h-auto text-left text-sm font-content rounded-lg hover:bg-muted outline-none w-full justify-start",
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
              <span className="text-xs text-muted-foreground ml-1">
                {group.items.length}
              </span>
            </Button>
          );
          return (
            <div
              key={group.key}
              className={cn("flex flex-col", !isTagGroup && "mt-4 first:mt-0")}
            >
              {isTagGroup ? (
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
                  className="inline-flex items-center gap-1 px-1 pb-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors outline-none select-none"
                >
                  {group.label}
                  <IconChevronRight
                    className={cn(
                      "size-3 transition-transform duration-150",
                      !closedDateKeys.has(group.key) && "rotate-90",
                    )}
                  />
                </button>
              )}
              <CollapsibleSection
                open={isTagGroup ? isOpen : !closedDateKeys.has(group.key)}
              >
                {group.items.map((item) => {
                  const typingTitle = typingTitles[item.id];
                  const rowItem = resolveRowItem(item, typingTitle);
                  return (
                    <ItemRow
                      key={`${group.key}:${item.id}`}
                      item={rowItem}
                      suppressHover={suppressHover}
                      density={density}
                      isTyping={typingTitle !== undefined}
                      onSelect={() => onSelect(item.id)}
                      onDelete={() => onDelete(item.id)}
                      onToggleRead={() => onToggleRead(item.id, !item.read)}
                      onTogglePin={() => onTogglePin(item.id, !item.starred)}
                    />
                  );
                })}
              </CollapsibleSection>
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
