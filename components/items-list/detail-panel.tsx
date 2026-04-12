import {
  IconCheck,
  IconGlobe,
  IconPlus,
  IconTrash,
  IconWand,
} from "@tabler/icons-react";
import Image from "next/image";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { type Item } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  getFlashcards,
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
} from "@/app/actions";

import { type EditFields, relativeTime, getFaviconSrc } from "./utils";
import { useAutofill } from "./use-autofill";
import { TagInput } from "./tag-input";

export const DetailPanel = ({
  item,
  isNew,
  onSave,
  onCreate,
  onFlashcardChange,
  onDelete,
}: {
  item: Item | null;
  isNew: boolean;
  onSave: (itemId: string, fields: EditFields) => void;
  onCreate: (fields: EditFields) => void;
  onFlashcardChange: () => void;
  onDelete?: () => void;
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

  // Refs
  const titleRef = React.useRef<HTMLInputElement>(null);
  const urlInputRef = React.useRef<HTMLInputElement>(null);
  const notesRef = React.useRef<HTMLTextAreaElement>(null);
  const itemIdRef = React.useRef<string | null>(null);
  const initFieldsRef = React.useRef({ title: "", url: "", tags: "", notes: "" });
  const getFieldsRef = React.useRef(() => ({ title, url, tags: tags.join(", "), notes }));
  getFieldsRef.current = () => ({ title, url, tags: tags.join(", "), notes });
  const onSaveRef = React.useRef(onSave);
  onSaveRef.current = onSave;
  const itemRef = React.useRef(item);
  itemRef.current = item;

  // Hooks
  const { showAutofill, fetching, handleAutofill, onUrlPaste } = useAutofill(url, title, setTitle);
  const queryClient = useQueryClient();
  const currentId = item?.id ?? (isNew ? "new" : null);

  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: ["flashcards", item?.id],
    queryFn: () => getFlashcards(item!.id),
    enabled: !!item?.id,
  });

  const addCardMutation = useMutation({
    mutationFn: ({ itemId, front, back }: { itemId: string; front: string; back: string }) =>
      createFlashcard(itemId, front, back),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flashcards", item?.id] });
      onFlashcardChange();
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: ({ id, front, back }: { id: string; front?: string; back?: string }) =>
      updateFlashcard(id, { front, back }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flashcards", item?.id] });
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
    initFieldsRef.current = { title: initialTitle, url: initialUrl, tags: initialTags.join(", "), notes: initialNotes };
    itemIdRef.current = currentId;
    setAddingCard(false);
    setNewFront("");
    setNewBack("");
    setEditingCardId(null);
  }, [currentId]);

  // Save on unmount
  React.useEffect(() => {
    return () => {
      const id = itemIdRef.current;
      if (!id) return;
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

  // Keyboard shortcuts within the panel
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (saving) return;
      const panel = document.querySelector("[data-detail-panel]");
      if (!panel?.contains(e.target as Node)) return;

      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        if (currentId) {
          setSaving(true);
          onSave(currentId, { title, url, tags: tags.join(", "), notes });
        }
      }
      if (e.key === "Backspace" && (e.metaKey || e.ctrlKey) && onDelete) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        onDelete();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [title, url, tags, notes, onSave, onDelete, saving, currentId]);

  // Callbacks
  const handleCardFocusOut = React.useCallback(
    (e: React.FocusEvent) => {
      const card = e.currentTarget;
      if (card.contains(e.relatedTarget as Node)) return;
      if (!editingCardId) return;
      const front = editFront.trim();
      const back = editBack.trim();
      if (!front || !back) return;
      updateCardMutation.mutate({ id: editingCardId, front, back });
      setEditingCardId(null);
    },
    [editingCardId, editFront, editBack, updateCardMutation],
  );

  const handleAddCard = React.useCallback(async () => {
    if (!item?.id || !newFront.trim() || !newBack.trim()) return;
    addCardMutation.mutate({ itemId: item.id, front: newFront.trim(), back: newBack.trim() });
    setNewFront("");
    setNewBack("");
    setAddingCard(false);
  }, [item?.id, newFront, newBack, addCardMutation]);

  const handleDeleteCard = React.useCallback(
    (cardId: string) => {
      if (editingCardId === cardId) setEditingCardId(null);
      deleteCardMutation.mutate(cardId);
    },
    [editingCardId, deleteCardMutation],
  );

  const startEditCard = React.useCallback(
    (card: { id: string; front: string; back: string }) => {
      setEditingCardId(card.id);
      setEditFront(card.front);
      setEditBack(card.back);
    },
    [],
  );

  const saveEditCard = async () => {
    if (!editingCardId) return;
    const front = editFront.trim();
    const back = editBack.trim();
    if (!front || !back) return;
    updateCardMutation.mutate({ id: editingCardId, front, back });
    setEditingCardId(null);
  }

  const faviconSrc = item ? getFaviconSrc(item) : null;

  return (
    <div
      data-detail-panel
      className="w-80 fixed top-14 overflow-y-auto max-h-[calc(100vh-4.5rem)] flex flex-col gap-2 detail-panel-scroll"
      style={{ left: "calc(50% + 19.5rem)" }}
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
              <IconGlobe className="size-5 text-muted-foreground" />
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
        <textarea
          ref={notesRef}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes..."
          rows={3}
          className="text-xs text-muted-foreground bg-transparent outline-none resize-none w-full placeholder:text-muted-foreground/40 field-sizing-content max-h-48 overflow-y-auto"
        />

        {/* Meta + Actions */}
        <div className="flex items-center justify-between mt-1">
          {item?.updatedAt ? (
            <span
              className="text-[10px] text-muted-foreground/40"
              title={new Date(item.updatedAt).toLocaleString()}
            >
              {relativeTime(item.updatedAt)}
            </span>
          ) : (
            <span />
          )}
          <div className="flex gap-0.5">
            {isNew && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground/50 hover:text-foreground"
                onClick={() => {
                  if (title.trim() || url.trim()) {
                    itemIdRef.current = null;
                    onCreate({ title, url, tags: tags.join(", "), notes });
                  }
                }}
                title="Create item"
              >
                <IconCheck />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground/40 hover:text-destructive"
                onClick={onDelete}
                title="Delete item"
              >
                <IconTrash />
              </Button>
            )}
          </div>
        </div>
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
            Add flashcard
          </Button>

          {addingCard && (
            <div
              className="rounded-lg bg-card px-4 py-3 flex flex-col gap-1.5"
              onBlur={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (newFront.trim() && newBack.trim()) {
                  handleAddCard();
                } else {
                  setAddingCard(false);
                  setNewFront("");
                  setNewBack("");
                }
              }}
            >
              <input
                autoFocus
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                placeholder="Front (question)"
                className="text-xs bg-transparent outline-none placeholder:text-muted-foreground/40"
              />
              <input
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                placeholder="Back (answer)"
                className="text-xs bg-transparent outline-none placeholder:text-muted-foreground/40"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddCard();
                  }
                }}
              />
            </div>
          )}

          {loadingCards && (
            <span className="text-[11px] text-muted-foreground/40 px-1">
              Loading...
            </span>
          )}

          {cards.map((card) => (
            <div
              key={card.id}
              className="font-content group rounded-lg bg-card px-4 py-3 flex flex-col gap-0.5 cursor-pointer"
              onClick={() => {
                if (editingCardId !== card.id) startEditCard(card);
              }}
              onBlur={editingCardId === card.id ? handleCardFocusOut : undefined}
            >
              {editingCardId === card.id ? (
                <>
                  <textarea
                    autoFocus
                    value={editFront}
                    onChange={(e) => setEditFront(e.target.value)}
                    rows={1}
                    className="text-xs font-medium bg-transparent outline-none w-full resize-none field-sizing-content"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveEditCard();
                      }
                    }}
                  />
                  <textarea
                    value={editBack}
                    onChange={(e) => setEditBack(e.target.value)}
                    rows={1}
                    className="text-xs text-muted-foreground bg-transparent outline-none w-full resize-none field-sizing-content"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveEditCard();
                      }
                    }}
                  />
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-medium">{card.front}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCard(card.id);
                      }}
                    >
                      <IconTrash />
                    </Button>
                  </div>
                  <span className="text-xs text-muted-foreground">{card.back}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
