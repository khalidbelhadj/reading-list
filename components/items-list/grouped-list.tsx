import { IconChevronRight, IconDots, IconFileFilled } from "@tabler/icons-react";
import Image from "next/image";
import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { type DbTag, type Item, isReadingListItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Spinner } from "@/components/ui/spinner";
import { deleteTag, renameTag } from "@/app/actions";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import {
  ItemContextMenu,
  ItemContextMenuTrigger,
  ItemDropdown,
} from "./item-dropdown";
import { getFaviconSrc } from "./utils";
import { type ItemGroup } from "./use-filters";

type GroupedListProps = {
  groups: ItemGroup[];
  selectedId: string | null;
  liveFields: { title: string; url: string; notes: string; tags: string[] } | null;
  typingTitles: Record<string, string>;
  suppressHover: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleRead: (id: string, read: boolean) => void;
};

export const GroupedList = ({
  groups,
  selectedId,
  liveFields,
  typingTitles,
  suppressHover,
  onSelect,
  onDelete,
  onToggleRead,
}: GroupedListProps) => {
  const queryClient = useQueryClient();
  const [openKeys, setOpenKeys] = React.useState<Set<string>>(() => new Set());
  const [renamingTagId, setRenamingTagId] = React.useState<number | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const [pendingDeleteTag, setPendingDeleteTag] = React.useState<DbTag | null>(
    null,
  );
  const [contextMenuOpenTagId, setContextMenuOpenTagId] = React.useState<
    number | null
  >(null);
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

  const toggle = React.useCallback((key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const startRename = React.useCallback((tag: DbTag) => {
    setRenamingTagId(tag.id);
    setRenameDraft(tag.name);
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

  const handleDeleteOpenChange = React.useCallback(
    (open: boolean) => {
      if (deleting) return;
      if (!open) setPendingDeleteTag(null);
    },
    [deleting],
  );

  const handleDeleteClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      confirmDelete();
    },
    [confirmDelete],
  );

  const handleDeleteKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (deleting) return;
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        confirmDelete();
      }
    },
    [confirmDelete, deleting],
  );

  const pendingDeleteCount = React.useMemo(() => {
    if (!pendingDeleteTag) return 0;
    return groups
      .flatMap((g) => g.items)
      .filter((item) => item.tags.some((t) => t.id === pendingDeleteTag.id))
      .length;
  }, [groups, pendingDeleteTag]);

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
          <button
            type="button"
            onClick={() => toggle(group.key)}
            className={cn(
              "flex items-center gap-1.5 p-1 text-left text-sm font-content rounded-lg hover:bg-card outline-none cursor-pointer w-full",
              isContextMenuOpen && "bg-card",
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
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => commitRename(tagForGroup)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename(tagForGroup);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  size={Math.max(renameDraft.length, 1)}
                  className="h-5 rounded-md bg-badge px-2 text-[0.625rem] font-medium text-badge-foreground outline-none ring-1 ring-foreground/20 field-sizing-content"
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
          </button>
        );
        return (
          <div key={group.key} className="flex flex-col">
            {tagForGroup ? (
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
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() => setPendingDeleteTag(tagForGroup)}
                  >
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ) : (
              headerButton
            )}
            {isOpen &&
              group.items.map((item) => {
                const typingTitle = typingTitles[item.id];
                const rowItem =
                  typingTitle !== undefined
                    ? { ...item, title: typingTitle }
                    : selectedId === item.id && liveFields
                      ? {
                          ...item,
                          title: liveFields.title,
                          url: liveFields.url,
                          notes: liveFields.notes,
                          tags: liveFields.tags.map((name, i) => ({
                            id: i,
                            name,
                            userId: item.userId,
                          })),
                        }
                      : item;
                return (
                  <PlainItemRow
                    key={`${group.key}:${item.id}`}
                    item={rowItem}
                    flashcardCount={item.flashcardCount}
                    isSelected={selectedId === item.id}
                    suppressHover={suppressHover}
                    isTyping={typingTitle !== undefined}
                    onSelect={() => onSelect(item.id)}
                    onDelete={() => onDelete(item.id)}
                    onToggleRead={
                      isReadingListItem(item)
                        ? () => onToggleRead(item.id, !item.read)
                        : undefined
                    }
                  />
                );
              })}
          </div>
        );
      })}
    </div>

    <AlertDialog
      open={pendingDeleteTag !== null}
      onOpenChange={handleDeleteOpenChange}
    >
      <AlertDialogContent onKeyDown={handleDeleteKeyDown}>
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
            disabled={deleting}
            onClick={handleDeleteClick}
          >
            {deleting && <Spinner className="size-3.5" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

const PlainItemRow = ({
  item,
  flashcardCount,
  isSelected,
  suppressHover,
  isTyping,
  onSelect,
  onDelete,
  onToggleRead,
}: {
  item: Item;
  flashcardCount: number;
  isSelected: boolean;
  suppressHover: boolean;
  isTyping?: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onToggleRead?: () => void;
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);
  const isRead = isReadingListItem(item) && item.read;

  return (
    <ItemContextMenu
      item={item}
      onToggleRead={onToggleRead}
      onDelete={onDelete}
      onOpenChange={setContextMenuOpen}
    >
    <ItemContextMenuTrigger
      render={
        <div
          data-item-id={item.id}
          onClick={onSelect}
          className={cn(
            "group relative flex items-center gap-2 p-1 pl-6 overflow-hidden select-none cursor-pointer outline-none rounded-lg",
            isSelected && "bg-secondary",
            !isSelected && !suppressHover && "hover:bg-card",
            !isSelected && (menuOpen || contextMenuOpen) && "bg-card",
            isRead && "opacity-50",
          )}
          data-menu-open={menuOpen || contextMenuOpen || undefined}
        />
      }
    >
      <div className="relative size-4 shrink-0">
        {getFaviconSrc(item) ? (
          <Image
            src={getFaviconSrc(item)!}
            alt=""
            width={16}
            height={16}
            className="size-4 rounded-[3px]"
            unoptimized
          />
        ) : (
          <IconFileFilled className="size-4 text-muted-foreground" />
        )}
      </div>
      <span
        data-item-title
        className={cn(
          "font-content text-sm truncate min-w-0",
          !item.title && !isTyping && "text-muted-foreground",
        )}
      >
        <span className="title-strike" data-read={isRead ? "true" : undefined}>
          {item.title || (isTyping ? " " : "Untitled")}
        </span>
      </span>
      {item.tags.length > 0 || flashcardCount > 0 ? (
        <div className="hidden sm:flex items-center gap-1 ml-auto shrink-0 max-w-1/2 overflow-hidden">
          {item.tags.map((t) => (
            <Badge key={t.id} variant="secondary" className="shrink-0">
              {t.name}
            </Badge>
          ))}
          {flashcardCount > 0 && (
            <Badge variant="secondary">{flashcardCount}</Badge>
          )}
        </div>
      ) : (
        <div className="hidden sm:block w-4 shrink-0" />
      )}
      <ItemDropdown
        item={item}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        onToggleRead={onToggleRead}
        onDelete={onDelete}
      >
        <div className="absolute inset-y-0 right-0 flex items-center pl-12 pr-1 pointer-events-none invisible group-hover:visible group-data-[menu-open]:visible">
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-r from-transparent",
              isSelected ? "via-secondary to-secondary" : "via-card to-card",
            )}
          />
          <DropdownMenuTrigger
            className={cn(
              "relative pointer-events-auto shrink-0 rounded p-1 text-muted-foreground hover:text-foreground outline-none",
              isSelected ? "bg-secondary" : "bg-card",
            )}
            onClick={stopPropagation}
            onPointerDown={stopPropagation}
          >
            <IconDots className="size-4" />
          </DropdownMenuTrigger>
        </div>
      </ItemDropdown>
    </ItemContextMenuTrigger>
    </ItemContextMenu>
  );
};

const stopPropagation = (e: React.SyntheticEvent) => {
  e.stopPropagation();
};
