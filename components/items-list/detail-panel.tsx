import {
  IconCheck,
  IconDots,
  IconFileFilled,
  IconMaximize,
  IconMinimize,
  IconPlus,
  IconWand,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type Flashcard, type Item } from "@/lib/types";
import { bumpItemFlashcardCount } from "@/lib/items-cache";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  TOOLTIP_DELAY_MS,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FlashcardCard } from "@/components/flashcards/flashcard-card";
import {
  createFlashcard,
  deleteFlashcard,
  getFlashcards,
  updateFlashcard,
} from "@/app/actions";

import { isTypingContext, isOverlayOpen } from "@/lib/input-context";

import { type EditFields, getFaviconSrc } from "./utils";
import { useAutofill } from "./use-autofill";
import { TagInput } from "./tag-input";
import { ItemDropdown } from "./item-dropdown";
import { MarkdownEditor } from "@/components/ui/markdown-editor";

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

  // Cards only fetched when the user enters the focused/expanded view —
  // the side panel just shows the count.
  const {
    data: cards = [],
    isError: cardsError,
  } = useQuery<Flashcard[]>({
    queryKey: ["flashcards", item?.id],
    queryFn: () => getFlashcards(item!.id),
    enabled: focused && !!item?.id,
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
      if (item?.id) bumpItemFlashcardCount(queryClient, item.id, 1);
      return { previous, tempId };
    },
    onSuccess: (realCard, _vars, context) => {
      queryClient.setQueryData(["flashcards", item?.id], (old: typeof cards) =>
        (old ?? []).map((c) => (c.id === context?.tempId ? realCard : c)),
      );
      queryClient.invalidateQueries({ queryKey: ["all-flashcards"] });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["flashcards", item?.id], context.previous);
        if (item?.id) bumpItemFlashcardCount(queryClient, item.id, -1);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-flashcards"] });
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
      if (item?.id) bumpItemFlashcardCount(queryClient, item.id, -1);
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["flashcards", item?.id], context.previous);
        if (item?.id) bumpItemFlashcardCount(queryClient, item.id, 1);
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
  const handleUpdateCard = React.useCallback(
    (id: string, fields: { front?: string; back?: string }) => {
      updateCardMutation.mutate({ id, ...fields });
    },
    [updateCardMutation],
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
      setDeletingCardId(cardId);
      try {
        await deleteCardMutation.mutateAsync(cardId);
      } finally {
        setDeletingCardId(null);
      }
    },
    [deleteCardMutation],
  );

  const handleExpandMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      onExpand?.();
    },
    [onExpand],
  );

  const handleSetTitle = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value),
    [],
  );

  const handleSetUrl = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value),
    [],
  );

  const handleSave = React.useCallback(() => {
    if (title.trim() || url.trim()) {
      setSaving(true);
      onCreate({ title, url, tags: tags.join(", "), notes });
    }
  }, [notes, onCreate, tags, title, url]);

  const handleAddingCard = React.useCallback(() => {
    setAddingCard(true);
  }, []);

  const handleAddingCardBlur = React.useCallback(
    (e: React.FocusEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      if (newFront.trim()) {
        handleAddCard();
      } else {
        setAddingCard(false);
        setNewFront("");
        setNewBack("");
      }
    },
    [handleAddCard, newFront],
  );

  const handleAddingCardKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        if (newFront.trim()) handleAddCard();
        return true;
      }
    },
    [handleAddCard, newFront],
  );

  const faviconSrc = getFaviconSrc({
    faviconUrl: item?.faviconUrl ?? null,
    url,
  });

  return (
    <div
      className="flex flex-col gap-2 w-full pb-12"
    >
      {/* Item form card */}
      <div className="flex flex-col gap-2">
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
            onChange={handleSetTitle}
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
            <TooltipProvider delay={TOOLTIP_DELAY_MS}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground/40 shrink-0"
                      onMouseDown={handleExpandMouseDown}
                    >
                      {focused ? <IconMinimize /> : <IconMaximize />}
                    </Button>
                  }
                />
                <TooltipContent>
                  {focused ? "Minimize" : "Expand"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
          {isNew && (
            <>
              {onCancel && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground/40 shrink-0 hover:text-foreground"
                  onClick={onCancel}
                  title="Cancel"
                >
                  <IconX />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground/50 shrink-0 -ml-2 hover:text-foreground"
                disabled={saving}
                onClick={handleSave}
                title="Create item"
              >
                {saving ? <Spinner className="size-3.5" /> : <IconCheck />}
              </Button>
            </>
          )}
        </div>

        {/* URL */}
        <input
          ref={urlInputRef}
          value={url}
          onChange={handleSetUrl}
          onPaste={onUrlPaste}
          placeholder="https://example.com"
          className="text-sm text-muted-foreground/70 bg-transparent outline-none placeholder:text-muted-foreground/40"
        />

        {/* Tags */}
        <TagInput value={tags} onChange={setTags} />

        {/* Notes */}
        <MarkdownEditor
          value={notes}
          onChange={setNotes}
          placeholder="Notes..."
          className="text-sm text-foreground [&_.ProseMirror]:min-h-8!"
        />

      </div>

      {/* Flashcards: collapsed shows count line, expanded shows full management. */}
      {item && !isNew && !focused && item.flashcardCount > 0 && (
        <span className="text-xs text-muted-foreground">
          {item.flashcardCount}{" "}
          {item.flashcardCount === 1 ? "flashcard" : "flashcards"}
        </span>
      )}

      {item && !isNew && focused && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {item.flashcardCount === 0
                ? "No flashcards"
                : `${item.flashcardCount} ${item.flashcardCount === 1 ? "flashcard" : "flashcards"}`}
            </span>
            <Button variant="ghost" onClick={handleAddingCard}>
              <IconPlus />
              Add card
            </Button>
          </div>

          {addingCard && (
            <div
              className="font-content rounded-lg bg-card px-4 py-3 flex flex-col gap-1.5"
              onBlur={handleAddingCardBlur}
            >
              <MarkdownEditor
                value={newFront}
                onChange={setNewFront}
                placeholder="Front"
                autoFocus
                className="text-xs font-medium"
                onKeyDown={handleAddingCardKeyDown}
              />
              <MarkdownEditor
                value={newBack}
                onChange={setNewBack}
                placeholder="Back"
                className="text-xs text-muted-foreground"
                onKeyDown={handleAddingCardKeyDown}
              />
            </div>
          )}

          {cardsError && (
            <div className="px-1 py-6 text-center text-destructive text-xs">
              Failed to load flashcards
            </div>
          )}

          {cards.map((card) => (
            <FlashcardCard
              key={card.id}
              card={card}
              onUpdate={handleUpdateCard}
              onDelete={handleDeleteCard}
              deleting={deletingCardId === card.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};
