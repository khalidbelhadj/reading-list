import React from "react";
import {
  IconChevronRight,
  IconListFilled,
  IconMoodSmile,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { getListIcon } from "@/lib/list-icons";
import { useLists, useListMutations } from "./use-lists";
import type { ListWithMembers } from "@/lib/lists";
import { IconPicker } from "./icon-picker";
import { CollapsibleSection } from "./grouped-list";

const CHIP_BASE =
  "shrink-0 inline-flex items-center gap-1.5 h-6 px-2 rounded-md cursor-pointer outline-none transition-colors";

export const ListsStrip = ({
  selectedListId,
  onSelectList,
  creating,
  onCreatingChange,
}: {
  selectedListId: string | null;
  onSelectList: (listId: string | null) => void;
  creating: boolean;
  onCreatingChange: (creating: boolean) => void;
}) => {
  const { data: lists } = useLists();
  const { createList, renameList, setListIcon, deleteList } = useListMutations();

  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(true);

  // If "New list" is triggered from the toolbar while the section is
  // collapsed, expand so the input chip is visible.
  React.useEffect(() => {
    if (creating) setOpen(true);
  }, [creating]);
  const [iconPickerListId, setIconPickerListId] = React.useState<string | null>(null);
  const iconAnchorsRef = React.useRef<Map<string, HTMLElement>>(new Map());
  const setIconAnchor = React.useCallback((listId: string, el: HTMLElement | null) => {
    if (el) iconAnchorsRef.current.set(listId, el);
    else iconAnchorsRef.current.delete(listId);
  }, []);

  const handleCreate = React.useCallback(
    (name: string) => {
      onCreatingChange(false);
      createList({ name: name.trim() });
    },
    [createList, onCreatingChange],
  );

  const handleRename = React.useCallback(
    (listId: string, name: string) => {
      setRenamingId(null);
      renameList({ listId, name: name.trim() });
    },
    [renameList],
  );

  const handleDelete = React.useCallback(
    (listId: string) => {
      if (selectedListId === listId) onSelectList(null);
      deleteList(listId);
    },
    [deleteList, onSelectList, selectedListId],
  );

  // Strip is fully hidden when no lists exist and we're not actively
  // creating one — creation is triggered from the toolbar's Add menu.
  if (!lists || (lists.length === 0 && !creating)) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="inline-flex self-start items-center gap-1 px-1 pb-0.5 text-xs text-muted-foreground cursor-pointer outline-none"
      >
        <IconListFilled className="size-3" />
        Lists
        <IconChevronRight
          className={cn(
            "size-3 transition-transform duration-150",
            open && "rotate-90",
          )}
        />
      </button>
      <CollapsibleSection open={open}>
        <div className="-mx-3">
          <div className="flex gap-1.5 overflow-x-auto px-3 py-0.5 scrollbar-thin">
            {lists.map((list) => (
          <ListChip
            key={list.id}
            list={list}
            selected={selectedListId === list.id}
            renaming={renamingId === list.id}
            onSelect={() =>
              onSelectList(selectedListId === list.id ? null : list.id)
            }
            onStartRename={() => setRenamingId(list.id)}
            onRename={(name) => handleRename(list.id, name)}
            onCancelRename={() => setRenamingId(null)}
            onChangeIcon={() => setIconPickerListId(list.id)}
            onDelete={() => handleDelete(list.id)}
            iconAnchorRef={(el) => setIconAnchor(list.id, el)}
          />
        ))}
            {creating && (
              <NewChipInput
                onCommit={handleCreate}
                onCancel={() => onCreatingChange(false)}
              />
            )}
          </div>
        </div>
      </CollapsibleSection>
      <IconPicker
        open={iconPickerListId !== null}
        onOpenChange={(o) => {
          if (!o) setIconPickerListId(null);
        }}
        anchor={
          iconPickerListId
            ? (iconAnchorsRef.current.get(iconPickerListId) ?? null)
            : null
        }
        selectedIcon={
          iconPickerListId
            ? (lists.find((l) => l.id === iconPickerListId)?.icon ?? null)
            : null
        }
        onSelect={(icon) => {
          if (!iconPickerListId) return;
          setListIcon({ listId: iconPickerListId, icon });
        }}
      />
    </div>
  );
};

const ListChip = ({
  list,
  selected,
  renaming,
  onSelect,
  onStartRename,
  onRename,
  onCancelRename,
  onChangeIcon,
  onDelete,
  iconAnchorRef,
}: {
  list: ListWithMembers;
  selected: boolean;
  renaming: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onChangeIcon: () => void;
  onDelete: () => void;
  iconAnchorRef: (el: HTMLElement | null) => void;
}) => {
  const count = list.itemIds.length;
  const Icon = getListIcon(list.icon);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            role="button"
            tabIndex={0}
            onClick={renaming ? undefined : onSelect}
            onKeyDown={(e) => {
              if (renaming) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }}
            className={cn(
              CHIP_BASE,
              selected
                ? "bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted text-foreground",
            )}
          >
            <button
              type="button"
              ref={iconAnchorRef}
              aria-label="Change icon"
              onClick={(e) => {
                e.stopPropagation();
                onChangeIcon();
              }}
              className={cn(
                "shrink-0 inline-flex items-center justify-center cursor-pointer outline-none rounded",
                selected ? "text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" />
            </button>
            {renaming ? (
              <RenameInput
                initial={list.name}
                onCommit={onRename}
                onCancel={onCancelRename}
              />
            ) : (
              <span
                className={cn(
                  "text-xs truncate min-w-16",
                  !list.name && "italic text-muted-foreground/70",
                )}
                title={list.name || "Untitled"}
              >
                {list.name || "Untitled"}
              </span>
            )}
            {count > 0 && (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  selected
                    ? "text-primary-foreground/60"
                    : "text-muted-foreground/70",
                )}
              >
                {count}
              </span>
            )}
          </div>
        }
      />
      <ContextMenuContent>
        <ContextMenuItem onClick={onStartRename}>
          <IconPencil />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={onChangeIcon}>
          <IconMoodSmile />
          Change icon
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <IconTrash />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

const NewChipInput = ({
  onCommit,
  onCancel,
}: {
  onCommit: (name: string) => void;
  onCancel: () => void;
}) => {
  const [value, setValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className={cn(CHIP_BASE, "bg-card")}>
      <IconListFilled className="size-3.5 text-muted-foreground" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onCommit(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit(value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="List name"
        size={1}
        className="text-xs bg-transparent outline-none placeholder:text-muted-foreground/60 field-sizing-content min-w-16"
      />
    </div>
  );
};

const RenameInput = ({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) => {
  const [value, setValue] = React.useState(initial);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      size={1}
      className="text-xs bg-transparent outline-none field-sizing-content min-w-16"
    />
  );
};
