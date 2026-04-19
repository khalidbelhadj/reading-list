import {
  IconArrowsMaximize,
  IconCheck,
  IconDots,
  IconFileFilled,
  IconPlus,
  IconTrash,
  IconWand,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { type Flashcard, type Item } from "@/lib/types";
import { useDebounced } from "@/lib/use-debounced";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  getFlashcards,
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
} from "@/app/actions";

import { isTypingContext, isOverlayOpen } from "@/lib/input-context";

import { type EditFields, getFaviconSrc } from "./utils";
import { useAutofill } from "./use-autofill";
import { TagInput } from "./tag-input";
import { ItemDropdown } from "./item-dropdown";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Skeleton } from "@/components/ui/skeleton";

// Order-independent key for dirty-tracking tag lists. Tags can change shape
// from outside the panel (rename/delete via the filter bar) and the server
// may return them in any order — compare as a sorted set, not a sequence.
const tagsKey = (names: string[]) => [...names].sort().join(", ");

export const DetailPanel = ({
  item,
  isNew,
  defaultTags,
  onSave,
  onCreate,
  onCancel,
  onFlashcardChange,
  onDelete,
  onToggleRead,
  onFieldsChange,
  onExpand,
  focused = false,
}: {
  item: Item | null;
  isNew: boolean;
  defaultTags?: string[];
  onSave: (itemId: string, fields: EditFields) => void;
  onCreate: (fields: EditFields) => void;
  onCancel?: () => void;
  onFlashcardChange: () => void;
  onDelete?: () => void;
  onToggleRead?: () => void;
  onFieldsChange?: (
    fields: {
      title: string;
      url: string;
      notes: string;
      tags: string[];
    } | null,
  ) => void;
  onExpand?: () => void;
  focused?: boolean;
}) => {
  // Form state — initialize from item synchronously so the first paint
  // already has the populated values (avoids a layout shift on mount).
  const [title, setTitle] = React.useState(() => item?.title ?? "");
  const [url, setUrl] = React.useState(() => item?.url ?? "");
  const [tags, setTags] = React.useState<string[]>(
    () => item?.tags.map((t) => t.name) ?? (isNew ? (defaultTags ?? []) : []),
  );
  const [notes, setNotes] = React.useState(() => item?.notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [newFront, setNewFront] = React.useState("");
  const [newBack, setNewBack] = React.useState("");
  const [addingCard, setAddingCard] = React.useState(false);
  const [editingCardId, setEditingCardId] = React.useState<string | null>(null);
  const [editFront, setEditFront] = React.useState("");
  const [editBack, setEditBack] = React.useState("");
  const [deletingCardId, setDeletingCardId] = React.useState<string | null>(
    null,
  );

  // Refs
  const titleRef = React.useRef<HTMLInputElement>(null);
  const urlInputRef = React.useRef<HTMLInputElement>(null);

  // Last-saved snapshot, for dirty detection. Initialized to the item's
  // persisted values (or seeded defaults for a new item) and updated after
  // each save.
  const lastSavedRef = React.useRef({
    title: item?.title ?? "",
    url: item?.url ?? "",
    tags: tagsKey(
      item?.tags.map((t) => t.name) ?? (isNew ? (defaultTags ?? []) : []),
    ),
    notes: item?.notes ?? "",
  });

  // Latest state, for reading in the unmount cleanup.
  const liveRef = React.useRef({ title, url, tags, notes });
  liveRef.current = { title, url, tags, notes };

  // Latest save callback, for reading in the unmount cleanup.
  const onSaveRef = React.useRef(onSave);
  onSaveRef.current = onSave;

  // Hooks
  const { showAutofill, fetching, handleAutofill, onUrlPaste } = useAutofill(
    url,
    title,
    setTitle,
  );
  const queryClient = useQueryClient();
  const currentId = item?.id ?? (isNew ? "new" : null);

  // Debounce the id used for fetching so rapid Ctrl+N/P doesn't fire a request
  // for every item the user passes through — only the one they settle on.
  const debouncedItemId = useDebounced(item?.id, 150);
  const { data: cards = [], isLoading: cardsLoading } = useQuery<Flashcard[]>({
    queryKey: ["flashcards", debouncedItemId],
    queryFn: () => getFlashcards(debouncedItemId!),
    enabled: !!debouncedItemId,
    // Cached forever within the session — mutations invalidate explicitly.
    staleTime: Infinity,
  });

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
      queryClient.setQueryData(["flashcards", item?.id], (old: typeof cards) =>
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
      queryClient.setQueryData(["flashcards", item?.id], (old: typeof cards) =>
        (old ?? []).map((c) =>
          c.id === id
            ? {
                ...c,
                ...(front !== undefined && { front }),
                ...(back !== undefined && { back }),
                updatedAt: new Date().toISOString(),
              }
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
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["flashcards", item?.id] });
      const previous = queryClient.getQueryData(["flashcards", item?.id]);
      queryClient.setQueryData(["flashcards", item?.id], (old: typeof cards) =>
        (old ?? []).filter((c) => c.id !== id),
      );
      onFlashcardChange();
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["flashcards", item?.id], context.previous);
        onFlashcardChange();
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["all-flashcards"] });
    },
  });

  // Focus the title when a new item's form first mounts.
  React.useEffect(() => {
    if (isNew) requestAnimationFrame(() => titleRef.current?.focus());
  }, [isNew]);

  const tagsPayload = tags.join(", ");
  const localTagsKey = tagsKey(tags);
  const serverTagsKey = tagsKey(item?.tags.map((t) => t.name) ?? []);

  // Sync local tags when the server-side list changes externally (rename or
  // delete from the tag filter bar). Skipped when the user has unsaved local
  // edits — the pending edit wins and goes out with the next save.
  React.useEffect(() => {
    if (isNew) return;
    if (serverTagsKey === lastSavedRef.current.tags) return;
    if (localTagsKey !== lastSavedRef.current.tags) return;
    setTags(item?.tags.map((t) => t.name) ?? []);
    lastSavedRef.current = { ...lastSavedRef.current, tags: serverTagsKey };
  }, [serverTagsKey, localTagsKey, isNew, item?.tags]);

  // Debounced server save
  React.useEffect(() => {
    if (isNew || !currentId || currentId === "new") return;
    const saved = lastSavedRef.current;
    if (
      title === saved.title &&
      url === saved.url &&
      localTagsKey === saved.tags &&
      notes === saved.notes
    ) {
      return;
    }
    const timeout = setTimeout(() => {
      onSaveRef.current(currentId, { title, url, tags: tagsPayload, notes });
      lastSavedRef.current = { title, url, tags: localTagsKey, notes };
    }, 1000);
    return () => clearTimeout(timeout);
  }, [title, url, localTagsKey, tagsPayload, notes, currentId, isNew]);

  // Report live form state to parent for rendering overrides.
  React.useEffect(() => {
    if (!currentId || currentId === "new") {
      onFieldsChange?.(null);
      return;
    }
    onFieldsChange?.({ title, url, notes, tags });
    return () => onFieldsChange?.(null);
  }, [title, url, notes, tags, currentId, onFieldsChange]);

  // Save on unmount if there are unflushed changes.
  React.useEffect(() => {
    return () => {
      if (!currentId || currentId === "new") return;
      const live = liveRef.current;
      const saved = lastSavedRef.current;
      const livePayload = live.tags.join(", ");
      const liveKey = tagsKey(live.tags);
      if (
        live.title === saved.title &&
        live.url === saved.url &&
        liveKey === saved.tags &&
        live.notes === saved.notes
      ) {
        return;
      }
      if (!live.title.trim() && !live.url.trim()) return;
      onSaveRef.current(currentId, {
        title: live.title,
        url: live.url,
        tags: livePayload,
        notes: live.notes,
      });
    };
  }, [currentId]);

  // Keyboard shortcuts within the panel
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (saving) return;
      if (isOverlayOpen()) return;

      const panel = document.querySelector("[data-detail-panel]");
      if (!panel?.contains(e.target as Node)) return;

      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        const payload = tags.join(", ");
        if (isNew) {
          if (title.trim() || url.trim()) {
            setSaving(true);
            onCreate({ title, url, tags: payload, notes });
          }
        } else if (currentId) {
          setSaving(true);
          onSave(currentId, { title, url, tags: payload, notes });
          lastSavedRef.current = { title, url, tags: tagsKey(tags), notes };
        }
      }
      if (e.key === "Backspace" && (e.metaKey || e.ctrlKey) && onDelete) {
        if (isTypingContext(e)) return;
        e.preventDefault();
        e.stopPropagation();
        onDelete();
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
    (
      card: { id: string; front: string; back: string },
      field?: "front" | "back",
    ) => {
      setEditingCardId(card.id);
      setEditFront(card.front);
      setEditBack(card.back);
      if (field) {
        requestAnimationFrame(() => {
          const selector =
            field === "front" ? "[data-card-front]" : "[data-card-back]";
          document.querySelector<HTMLTextAreaElement>(selector)?.focus();
        });
      }
    },
    [],
  );

  const handleExpandMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      onExpand?.();
    },
    [onExpand],
  );

  const faviconSrc = item ? getFaviconSrc(item) : null;

  return (
    <div className="flex flex-col gap-2 w-full">
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
              <IconFileFilled className="size-5 text-muted-foreground" />
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
              onMouseDown={handleExpandMouseDown}
              title="Expand"
            >
              <IconArrowsMaximize />
            </Button>
          )}
          {!isNew && item && (
            <ItemDropdown
              item={item}
              onToggleRead={onToggleRead}
              onDelete={onDelete}
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
            Array.from({ length: 5 }).map((_, i) => (
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
                  deletingCardId === card.id
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100",
                )}
                disabled={deletingCardId === card.id}
                onClick={() => handleDeleteCard(card.id)}
              >
                {deletingCardId === card.id ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <IconTrash />
                )}
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
    </div>
  );
};
