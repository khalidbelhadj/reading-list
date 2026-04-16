import {
  IconArrowsMaximize,
  IconCheck,
  IconDots,
  IconFile,
  IconPlus,
  IconTrash,
  IconWand,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import React from "react";
import { motion } from "motion/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  getFlashcards,
  getFlashcardCounts,
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
} from "@/app/actions";

import { type EditFields, getFaviconSrc } from "./utils";
import { useAutofill } from "./use-autofill";
import { TagInput } from "./tag-input";
import { ItemDropdown } from "./item-dropdown";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Skeleton } from "@/components/ui/skeleton";

export const DetailPanel = ({
  item,
  isNew,
  onSave,
  onCreate,
  onCancel,
  onFlashcardChange,
  onDelete,
  onToggleRead,
  onFieldsChange,
  deleteDialogOpen,
  setDeleteDialogOpen,
  onExpand,
  focused = false,
}: {
  item: Item | null;
  isNew: boolean;
  onSave: (itemId: string, fields: EditFields) => void;
  onCreate: (fields: EditFields) => void;
  onCancel?: () => void;
  onFlashcardChange: () => void;
  onDelete?: () => Promise<void> | void;
  onToggleRead?: () => void;
  onFieldsChange?: (fields: { title: string; url: string; notes: string; tags: string[] } | null) => void;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onExpand?: () => void;
  focused?: boolean;
}) => {
  // Form state
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [newFront, setNewFront] = React.useState("");
  const [newBack, setNewBack] = React.useState("");
  const [addingCard, setAddingCard] = React.useState(false);
  const [editingCardId, setEditingCardId] = React.useState<string | null>(null);
  const [editFront, setEditFront] = React.useState("");
  const [editBack, setEditBack] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [deletingCardId, setDeletingCardId] = React.useState<string | null>(null);

  // Refs
  const titleRef = React.useRef<HTMLInputElement>(null);
  const urlInputRef = React.useRef<HTMLInputElement>(null);
  const itemIdRef = React.useRef<string | null>(null);
  const justSwitchedRef = React.useRef(false);
  const initFieldsRef = React.useRef({
    title: "",
    url: "",
    tags: "",
    notes: "",
  });
  const getFieldsRef = React.useRef(() => ({
    title,
    url,
    tags: tags.join(", "),
    notes,
  }));
  getFieldsRef.current = () => ({ title, url, tags: tags.join(", "), notes });
  const onSaveRef = React.useRef(onSave);
  onSaveRef.current = onSave;
  const itemRef = React.useRef(item);
  itemRef.current = item;

  // Hooks
  const { showAutofill, fetching, handleAutofill, onUrlPaste } = useAutofill(
    url,
    title,
    setTitle,
  );
  const queryClient = useQueryClient();
  const currentId = item?.id ?? (isNew ? "new" : null);

  const { data: cards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ["flashcards", item?.id],
    queryFn: () => getFlashcards(item!.id),
    enabled: !!item?.id,
  });
  const { data: flashcardCounts, isLoading: countsLoading } = useQuery({
    queryKey: ["flashcard-counts"],
    queryFn: getFlashcardCounts,
  });
  const expectedCardCount = item
    ? (flashcardCounts?.get(item.id) ?? 0)
    : 0;
  // If counts are still loading, fall back to 5; otherwise use the known count.
  const skeletonCount = countsLoading ? 5 : expectedCardCount;

  const addCardMutation = useMutation({
    mutationFn: ({
      itemId,
      front,
      back,
    }: {
      itemId: string;
      front: string;
      back: string;
    }) => createFlashcard(itemId, front, back),
    onMutate: async ({ front, back }) => {
      await queryClient.cancelQueries({ queryKey: ["flashcards", item?.id] });
      const previous = queryClient.getQueryData(["flashcards", item?.id]);
      const tempId = `temp-${Date.now()}`;
      const optimisticCard = {
        id: tempId,
        itemId: item?.id ?? null,
        front,
        back,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData(
        ["flashcards", item?.id],
        (old: typeof cards) => [optimisticCard, ...(old ?? [])],
      );
      onFlashcardChange();
      return { previous, tempId };
    },
    onSuccess: (realCard, _vars, context) => {
      // Replace the temp card with the real one — no refetch needed
      queryClient.setQueryData(
        ["flashcards", item?.id],
        (old: typeof cards) =>
          (old ?? []).map((c) => (c.id === context?.tempId ? realCard : c)),
      );
      queryClient.invalidateQueries({ queryKey: ["all-flashcards"] });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["flashcards", item?.id], context.previous);
        onFlashcardChange();
      }
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: ({
      id,
      front,
      back,
    }: {
      id: string;
      front?: string;
      back?: string;
    }) => updateFlashcard(id, { front, back }),
    onMutate: async ({ id, front, back }) => {
      await queryClient.cancelQueries({ queryKey: ["flashcards", item?.id] });
      const previous = queryClient.getQueryData(["flashcards", item?.id]);
      queryClient.setQueryData(
        ["flashcards", item?.id],
        (old: typeof cards) =>
          (old ?? []).map((c) =>
            c.id === id
              ? { ...c, ...(front !== undefined && { front }), ...(back !== undefined && { back }), updatedAt: new Date().toISOString() }
              : c,
          ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["flashcards", item?.id], context.previous);
      }
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => deleteFlashcard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flashcards", item?.id] });
      onFlashcardChange();
    },
  });

  // Initialize fields when item changes
  React.useEffect(() => {
    const prevId = itemIdRef.current;
    if (prevId !== null && prevId !== currentId) {
      const prev = getFieldsRef.current();
      const init = initFieldsRef.current;
      const hasChanges =
        prev.title !== init.title ||
        prev.url !== init.url ||
        prev.tags !== init.tags ||
        prev.notes !== init.notes;
      if (hasChanges && (prev.title.trim() || prev.url.trim())) {
        onSaveRef.current(prevId, prev);
      }
    }

    const currentItem = itemRef.current;
    const initialTitle = currentItem?.title ?? "";
    const initialUrl = currentItem?.url ?? "";
    const initialTags = currentItem?.tags.map((tag) => tag.name) ?? [];
    const initialNotes = currentItem?.notes ?? "";
    setTitle(initialTitle);
    setUrl(initialUrl);
    setTags(initialTags);
    setNotes(initialNotes);
    setSaving(false);
    initFieldsRef.current = {
      title: initialTitle,
      url: initialUrl,
      tags: initialTags.join(", "),
      notes: initialNotes,
    };
    itemIdRef.current = currentId;
    justSwitchedRef.current = true;
    setAddingCard(false);
    setNewFront("");
    setNewBack("");
    setEditingCardId(null);
    if (isNew) {
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }, [currentId, isNew]);

  // Debounced server save
  const tagsString = tags.join(", ");
  React.useEffect(() => {
    if (justSwitchedRef.current) {
      justSwitchedRef.current = false;
      return;
    }
    if (isNew || !currentId || currentId === "new") return;
    const fields = { title, url, tags: tagsString, notes };
    const init = initFieldsRef.current;
    const hasChanges =
      fields.title !== init.title ||
      fields.url !== init.url ||
      fields.tags !== init.tags ||
      fields.notes !== init.notes;
    if (!hasChanges) return;

    const timeout = setTimeout(() => {
      onSaveRef.current(currentId, fields);
      initFieldsRef.current = fields;
    }, 1000);
    return () => clearTimeout(timeout);
  }, [title, url, tagsString, notes, currentId, isNew]);

  // Report live form state to parent for rendering overrides
  const prevIdForFieldsRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!currentId || currentId === "new") {
      onFieldsChange?.(null);
      prevIdForFieldsRef.current = currentId;
      return;
    }
    // Skip the first render after switching items — form state is stale
    if (prevIdForFieldsRef.current !== currentId) {
      prevIdForFieldsRef.current = currentId;
      return;
    }
    onFieldsChange?.({ title, url, notes, tags });
    return () => onFieldsChange?.(null);
  }, [title, url, notes, tags, currentId, onFieldsChange]);

  // Save on unmount
  React.useEffect(() => {
    return () => {
      const id = itemIdRef.current;
      if (!id || id === "new") return;
      const current = getFieldsRef.current();
      const init = initFieldsRef.current;
      const hasChanges =
        current.title !== init.title ||
        current.url !== init.url ||
        current.tags !== init.tags ||
        current.notes !== init.notes;
      if (hasChanges && (current.title.trim() || current.url.trim())) {
        onSaveRef.current(id, current);
      }
    };
  }, []);

  const confirmDelete = React.useCallback(async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [onDelete, setDeleteDialogOpen]);

  // Keyboard shortcuts within the panel
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (saving) return;

      // Confirm delete dialog with Cmd+Enter
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && deleteDialogOpen && onDelete && !deleting) {
        e.preventDefault();
        confirmDelete();
        return;
      }

      const panel = document.querySelector("[data-detail-panel]");
      if (!panel?.contains(e.target as Node)) return;

      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        if (isNew) {
          if (title.trim() || url.trim()) {
            setSaving(true);
            itemIdRef.current = null;
            onCreate({ title, url, tags: tags.join(", "), notes });
          }
        } else if (currentId) {
          setSaving(true);
          onSave(currentId, { title, url, tags: tags.join(", "), notes });
        }
      }
      if (e.key === "Backspace" && (e.metaKey || e.ctrlKey) && onDelete) {
        const target = e.target as HTMLElement;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
        e.preventDefault();
        setDeleteDialogOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    title,
    url,
    tags,
    notes,
    onSave,
    onCreate,
    onDelete,
    saving,
    currentId,
    isNew,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleting,
    confirmDelete,
  ]);

  // Callbacks
  const saveAndCloseCard = React.useCallback(
    (cardId: string) => {
      const front = editFront.trim();
      const back = editBack.trim();
      if (front) {
        queryClient.setQueryData(
          ["flashcards", item?.id],
          (old: typeof cards) =>
            (old ?? []).map((c) =>
              c.id === cardId ? { ...c, front, back } : c,
            ),
        );
        updateCardMutation.mutate({ id: cardId, front, back });
      }
      setEditingCardId(null);
    },
    [editFront, editBack, item?.id, queryClient, updateCardMutation],
  );

  const handleCardFocusOut = React.useCallback(
    (e: React.FocusEvent) => {
      const card = e.currentTarget;
      if (card.contains(e.relatedTarget as Node)) return;
      if (!editingCardId) return;
      saveAndCloseCard(editingCardId);
    },
    [editingCardId, saveAndCloseCard],
  );

  const handleAddCard = React.useCallback(async () => {
    if (!item?.id || !newFront.trim()) return;
    addCardMutation.mutate({
      itemId: item.id,
      front: newFront.trim(),
      back: newBack.trim(),
    });
    setNewFront("");
    setNewBack("");
    setAddingCard(false);
  }, [item?.id, newFront, newBack, addCardMutation]);

  const handleDeleteCard = React.useCallback(
    async (cardId: string) => {
      if (editingCardId === cardId) setEditingCardId(null);
      setDeletingCardId(cardId);
      try {
        await deleteCardMutation.mutateAsync(cardId);
      } finally {
        setDeletingCardId(null);
      }
    },
    [editingCardId, deleteCardMutation],
  );

  const startEditCard = React.useCallback(
    (card: { id: string; front: string; back: string }, field?: "front" | "back") => {
      setEditingCardId(card.id);
      setEditFront(card.front);
      setEditBack(card.back);
      if (field) {
        requestAnimationFrame(() => {
          const selector = field === "front" ? "[data-card-front]" : "[data-card-back]";
          document.querySelector<HTMLTextAreaElement>(selector)?.focus();
        });
      }
    },
    [],
  );

  const faviconSrc = item ? getFaviconSrc(item) : null;

  return (
    <motion.div
      layoutId="item-card"
      layoutDependency={focused ? "focused" : "side"}
      transition={{ type: "spring", visualDuration: 0.22, bounce: 0 }}
      data-detail-panel
      className={cn(
        "flex flex-col gap-2",
        focused
          ? "w-full"
          : "w-80 fixed top-5 overflow-y-auto max-h-[calc(100vh-2.5rem)] detail-panel-scroll",
      )}
      style={focused ? undefined : { left: "calc(50% + 19.5rem)" }}
    >
      {/* Item form card */}
      <div className="rounded-lg bg-card px-3 py-3 flex flex-col gap-2">
        {/* Favicon + Title */}
        <div className="flex items-center gap-2">
          <div className="size-5 shrink-0 flex items-center justify-center">
            {faviconSrc ? (
              <Image
                src={faviconSrc}
                alt=""
                width={20}
                height={20}
                className="size-5 rounded"
                unoptimized
              />
            ) : (
              <IconFile className="size-5 text-muted-foreground" />
            )}
          </div>
          <input
            ref={titleRef}
            data-detail-title
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="font-content flex-1 min-w-0 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {showAutofill && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/50"
              onClick={handleAutofill}
              disabled={fetching}
              title="Autofill title from URL"
            >
              {fetching ? <Spinner className="size-3.5" /> : <IconWand />}
            </Button>
          )}
          {!isNew && onExpand && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/40 shrink-0"
              onClick={onExpand}
              title="Expand"
            >
              <IconArrowsMaximize />
            </Button>
          )}
          {!isNew && item && (
            <ItemDropdown
              item={item}
              onToggleRead={onToggleRead}
              onDelete={onDelete ? () => setDeleteDialogOpen(true) : undefined}
            >
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground/40 shrink-0 -ml-2"
                  >
                    <IconDots />
                  </Button>
                }
              />
            </ItemDropdown>
          )}
        </div>

        {/* URL */}
        <input
          ref={urlInputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={onUrlPaste}
          placeholder="https://example.com"
          className="text-xs text-muted-foreground/70 bg-transparent outline-none placeholder:text-muted-foreground/40"
        />

        {/* Tags */}
        <TagInput value={tags} onChange={setTags} />

        {/* Notes */}
        <MarkdownEditor
          value={notes}
          onChange={setNotes}
          placeholder="Notes..."
          className={cn(
            "text-xs text-muted-foreground",
            focused ? "" : "max-h-48 overflow-y-auto",
          )}
        />

        {/* Actions (new item only) */}
        {isNew && (
          <div className="flex items-center justify-end mt-1 gap-0.5">
            {onCancel && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground/40 hover:text-foreground"
                onClick={onCancel}
                title="Cancel"
              >
                <IconX />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/50 hover:text-foreground"
              disabled={saving}
              onClick={() => {
                if (title.trim() || url.trim()) {
                  setSaving(true);
                  itemIdRef.current = null;
                  onCreate({ title, url, tags: tags.join(", "), notes });
                }
              }}
              title="Create item"
            >
              {saving ? <Spinner className="size-3.5" /> : <IconCheck />}
            </Button>
          </div>
        )}
      </div>

      {/* Flashcards */}
      {item && !isNew && (
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            className="rounded-lg bg-card text-muted-foreground/50"
            onClick={() => setAddingCard(true)}
          >
            <IconPlus />
            Add card
          </Button>

          {addingCard && (
            <div
              className="font-content rounded-lg bg-card px-4 py-3 flex flex-col gap-1.5"
              onBlur={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (newFront.trim()) {
                  handleAddCard();
                } else {
                  setAddingCard(false);
                  setNewFront("");
                  setNewBack("");
                }
              }}
            >
              <MarkdownEditor
                value={newFront}
                onChange={setNewFront}
                placeholder="Front"
                autoFocus
                className="text-xs font-medium"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    if (newFront.trim()) handleAddCard();
                    return true;
                  }
                }}
              />
              <MarkdownEditor
                value={newBack}
                onChange={setNewBack}
                placeholder="Back"
                className="text-xs text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    if (newFront.trim()) handleAddCard();
                    return true;
                  }
                }}
              />
            </div>
          )}

          {cardsLoading &&
            skeletonCount > 0 &&
            Array.from({ length: skeletonCount }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                style={{ opacity: Math.max(1 - i * 0.2, 0.2) }}
              >
                <Skeleton className="h-22 rounded-lg" />
              </div>
            ))}

          {cards.map((card) => (
            <div
              key={card.id}
              className="font-content group relative rounded-lg bg-card px-4 py-3"
              onBlur={
                editingCardId === card.id ? handleCardFocusOut : undefined
              }
            >
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute top-1 right-1 text-muted-foreground/30 hover:text-destructive",
                  deletingCardId === card.id ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                disabled={deletingCardId === card.id}
                onClick={() => handleDeleteCard(card.id)}
              >
                {deletingCardId === card.id ? <Spinner className="size-3.5" /> : <IconTrash />}
              </Button>
              {editingCardId === card.id ? (
                <div className="flex flex-col gap-0.5">
                  <MarkdownEditor
                    value={editFront}
                    onChange={setEditFront}
                    autoFocus
                    editorAttributes={{ "data-card-front": "" }}
                    className="text-xs font-medium"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        saveAndCloseCard(card.id);
                        return true;
                      }
                    }}
                  />
                  <MarkdownEditor
                    value={editBack}
                    onChange={setEditBack}
                    placeholder="Back"
                    editorAttributes={{ "data-card-back": "" }}
                    className="text-xs text-muted-foreground"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        saveAndCloseCard(card.id);
                        return true;
                      }
                    }}
                  />
                </div>
              ) : (
                <>
                  <div
                    className="cursor-pointer"
                    onClick={() => startEditCard(card, "front")}
                  >
                    <MarkdownEditor
                      value={card.front}
                      editable={false}
                      className="text-xs font-medium"
                    />
                  </div>
                  <div
                    className="grid transition-[grid-template-rows] duration-150"
                    style={{ gridTemplateRows: card.back ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <div
                        className="cursor-pointer mt-0.5"
                        onClick={() => startEditCard(card, "back")}
                      >
                        <MarkdownEditor
                          value={card.back}
                          editable={false}
                          className="text-xs text-muted-foreground"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {onDelete && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this item? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {item && (
              <div className="flex items-center gap-2 rounded-md bg-card px-1 py-1 ring-1 ring-foreground/5 min-w-0 overflow-hidden">
                <div className="size-5 shrink-0 flex items-center justify-center">
                  {faviconSrc ? (
                    <Image
                      src={faviconSrc}
                      alt=""
                      width={20}
                      height={20}
                      className="size-5 rounded"
                      unoptimized
                    />
                  ) : (
                    <IconFile className="size-5 text-muted-foreground" />
                  )}
                </div>
                <span className="font-content text-sm truncate">
                  {item.title || "Untitled"}
                </span>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleting}
                onClick={(e) => {
                  e.preventDefault();
                  confirmDelete();
                }}
              >
                {deleting ? <Spinner className="size-3.5" /> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </motion.div>
  );
};
