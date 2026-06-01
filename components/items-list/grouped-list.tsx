import {
  IconChevronRight,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import React from "react";

import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteTagDialog } from "@/components/items-list/delete-tag-dialog";
import { TagRenameInput } from "@/components/items-list/tag-rename-input";
import { useTagMutations } from "@/components/items-list/use-tag-mutations";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import {
  ItemContextMenu,
  ItemContextMenuTrigger,
} from "./item-dropdown";
import { resolveRowItem, type Density } from "./utils";
import { CozyRowContent } from "./cozy-row-content";
import { type ItemGroup } from "./use-filters";
import { ItemRowContent } from "./item-row-content";
import { useHoverPreview, HoverPreviewContent } from "@/components/ui/preview-card";
import { ItemPreview } from "./item-preview";
import { useIsCursor, useIsOpenItem } from "./cursor-store";

export const CollapsibleSection = ({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) => {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const prevOpen = React.useRef(open);

  React.useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    if (prevOpen.current === open) {
      outer.style.height = open ? "" : "0px";
      return;
    }
    prevOpen.current = open;

    const h = inner.scrollHeight;

    outer.style.transition = "none";
    outer.style.height = open ? "0px" : `${h}px`;
    outer.getBoundingClientRect();
    outer.style.transition = "";
    outer.style.height = open ? `${h}px` : "0px";

    if (open) {
      const onEnd = () => {
        outer.style.height = "";
        outer.removeEventListener("transitionend", onEnd);
      };
      outer.addEventListener("transitionend", onEnd);
      return () => outer.removeEventListener("transitionend", onEnd);
    }
  }, [open]);

  return (
    <div
      ref={outerRef}
      className="overflow-hidden transition-[height] duration-250 ease-in-out"
    >
      <div ref={innerRef}>
        {children}
      </div>
    </div>
  );
};

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
  const [closedDateKeys, setClosedDateKeys] = React.useState<Set<string>>(() => new Set());
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
            ? (group.items[0]?.tags.find((t) => t.name === group.label) ?? null)
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
          <div key={group.key} className={cn("flex flex-col", !isTagGroup && "mt-4 first:mt-0")}>
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
                className="inline-flex items-center gap-1 px-1 pb-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors outline-none"
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
            <CollapsibleSection open={isTagGroup ? isOpen : !closedDateKeys.has(group.key)}>
              {group.items.map((item) => {
                const typingTitle = typingTitles[item.id];
                const rowItem = resolveRowItem(item, typingTitle);
                return (
                  <PlainItemRow
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
      onOpenChange={(open) => { if (!open) setPendingDeleteTag(null); }}
      onConfirm={confirmDelete}
    />
    </>
  );
};

const PREVIEW_DELAY = 1000;

export const PlainItemRow = ({
  item,
  suppressHover,
  isTyping,
  density = "compact",
  onSelect,
  onDelete,
  onToggleRead,
  onTogglePin,
}: {
  item: Item;
  suppressHover: boolean;
  isTyping?: boolean;
  density?: Density;
  onSelect: () => void;
  onDelete?: () => void;
  onToggleRead?: () => void;
  onTogglePin?: () => void;
}) => {
  const isCursor = useIsCursor(item.id);
  const isOpen = useIsOpenItem(item.id);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);
  const preview = useHoverPreview(PREVIEW_DELAY);
  const isRead = item.read;

  React.useEffect(() => {
    if (menuOpen || contextMenuOpen) preview.dismiss();
  }, [menuOpen, contextMenuOpen, preview]);

  return (
    <>
    <ItemContextMenu
      item={item}
      onTogglePin={onTogglePin}
      onToggleRead={onToggleRead}
      onDelete={onDelete}
      onOpenChange={setContextMenuOpen}
    >
    <ItemContextMenuTrigger
      render={
        <div
          data-item-id={item.id}
          onClick={onSelect}
          onMouseEnter={density === "cozy" ? undefined : preview.onMouseEnter}
          onMouseMove={density === "cozy" ? undefined : preview.onMouseMove}
          onMouseLeave={density === "cozy" ? undefined : preview.onMouseLeave}
          className={cn(
            "group relative flex overflow-hidden select-none outline-none rounded-lg",
            density === "cozy"
              ? "items-stretch gap-3 p-2"
              : "items-center gap-2 p-1",
            isOpen && "bg-secondary",
            !isOpen && isCursor && (density === "cozy" ? "bg-foreground/5" : "bg-muted"),
            !isOpen && !isCursor && !suppressHover && (density === "cozy" ? "hover:bg-foreground/5" : "hover:bg-muted"),
            !isOpen && !isCursor && (menuOpen || contextMenuOpen) && (density === "cozy" ? "bg-foreground/5" : "bg-muted"),
            isRead && "opacity-50",
          )}
          data-menu-open={menuOpen || contextMenuOpen || undefined}
        />
      }
    >
      {density === "cozy" ? (
        <CozyRowContent
          item={item}
          isSelected={isOpen}
          isTyping={isTyping}
          menuOpen={menuOpen}
          suppressHover={suppressHover}
          onMenuOpenChange={setMenuOpen}
          onTogglePin={onTogglePin}
          onToggleRead={onToggleRead}
          onDelete={onDelete}
        />
      ) : (
        <ItemRowContent
          item={item}
          flashcardCount={item.flashcardCount}
          isSelected={isOpen}
          isTyping={isTyping}
          menuOpen={menuOpen}
          suppressHover={suppressHover}
          onMenuOpenChange={setMenuOpen}
          onTogglePin={onTogglePin}
          onToggleRead={onToggleRead}
          onDelete={onDelete}
        />
      )}
    </ItemContextMenuTrigger>
    </ItemContextMenu>
    {density !== "cozy" && (
      <HoverPreviewContent open={preview.open} position={preview.position}>
        <ItemPreview item={item} />
      </HoverPreviewContent>
    )}
    </>
  );
};
