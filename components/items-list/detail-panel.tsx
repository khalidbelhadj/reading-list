import {
  IconCheck,
  IconGlobe,
  IconPlus,
  IconTrash,
  IconWand,
} from "@tabler/icons-react";
import Image from "next/image";
import React from "react";

import { type Item, type Flashcard } from "@/lib/types";
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

export function DetailPanel({
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
}) {
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const urlInputRef = React.useRef<HTMLInputElement>(null);
  const notesRef = React.useRef<HTMLTextAreaElement>(null);
  const { showAutofill, fetching, handleAutofill, onUrlPaste } = useAutofill(url, title, setTitle);

  // Flashcards state
  const [cards, setCards] = React.useState<Flashcard[]>([]);
  const [loadingCards, setLoadingCards] = React.useState(false);
  const [newFront, setNewFront] = React.useState("");
  const [newBack, setNewBack] = React.useState("");
  const [addingCard, setAddingCard] = React.useState(false);
  const [editingCardId, setEditingCardId] = React.useState<string | null>(null);
  const [editFront, setEditFront] = React.useState("");
  const [editBack, setEditBack] = React.useState("");

  // Track the current item id to detect switches
  const itemIdRef = React.useRef<string | null>(null);
  const getFieldsRef = React.useRef(() => ({ title, url, tags: tags.join(", "), notes }));
  getFieldsRef.current = () => ({ title, url, tags: tags.join(", "), notes });

  const initFieldsRef = React.useRef({ title: "", url: "", tags: "", notes: "" });

  // Initialize fields when item changes
  const currentId = item?.id ?? (isNew ? "new" : null);

  const onSaveRef = React.useRef(onSave);
  onSaveRef.current = onSave;
  const itemRef = React.useRef(item);
  itemRef.current = item;

  React.useEffect(() => {
    // Auto-save previous item if changed
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

    // Set new fields
    const currentItem = itemRef.current;
    const t = currentItem?.title ?? "";
    const u = currentItem?.url ?? "";
    const tg = currentItem?.tags.map((tag) => tag.name) ?? [];
    const n = currentItem?.notes ?? "";
    setTitle(t);
    setUrl(u);
    setTags(tg);
    setNotes(n);
    setSaving(false);
    initFieldsRef.current = { title: t, url: u, tags: tg.join(", "), notes: n };
    itemIdRef.current = currentId;

    // Fetch flashcards for this item
    setCards([]);
    setAddingCard(false);
    setNewFront("");
    setNewBack("");
    setEditingCardId(null);
    if (currentItem?.id) {
      setLoadingCards(true);
      getFlashcards(currentItem.id).then((c) => {
        setCards(c);
        setLoadingCards(false);
      });
    }
  }, [currentId]);

  // Save on unmount (e.g. Escape closing the panel)
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
    function handleKeyDown(e: KeyboardEvent) {
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
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [title, url, tags, notes, onSave, onDelete, saving, currentId]);

  // When focus leaves the editing card (click outside, Escape blur, tab away) → save and exit
  function handleCardFocusOut(e: React.FocusEvent) {
    const card = e.currentTarget;
    if (card.contains(e.relatedTarget as Node)) return;
    saveEditCard();
  }

  async function handleAddCard() {
    if (!item?.id || !newFront.trim() || !newBack.trim()) return;
    const card = await createFlashcard(item.id, newFront.trim(), newBack.trim());
    setCards((prev) => [card, ...prev]);
    setNewFront("");
    setNewBack("");
    setAddingCard(false);
    onFlashcardChange();
  }

  async function handleDeleteCard(cardId: string) {
    await deleteFlashcard(cardId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    if (editingCardId === cardId) setEditingCardId(null);
    onFlashcardChange();
  }

  function startEditCard(card: Flashcard) {
    setEditingCardId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
  }

  async function saveEditCard() {
    if (!editingCardId) return;
    const front = editFront.trim();
    const back = editBack.trim();
    if (!front || !back) return;
    await updateFlashcard(editingCardId, { front, back });
    setCards((prev) =>
      prev.map((c) => c.id === editingCardId ? { ...c, front, back } : c),
    );
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

      {/* Flashcards — each as its own card below */}
      {item && !isNew && (
        <div className="flex flex-col gap-2">
          {/* Add card button */}
          <Button
            variant="ghost"
            className="rounded-lg bg-card text-muted-foreground/50"
            onClick={() => setAddingCard(true)}
          >
            <IconPlus />
            Add flashcard
          </Button>

          {/* New card form */}
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

          {/* Saved cards */}
          {loadingCards && (
            <span className="text-[11px] text-muted-foreground/40 px-1">Loading...</span>
          )}
          {cards.map((card) => (
            <div
              key={card.id}
              className="font-content group rounded-lg bg-card px-4 py-3 flex flex-col gap-0.5 cursor-pointer"
              onClick={() => { if (editingCardId !== card.id) startEditCard(card); }}
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
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEditCard(); }
                    }}
                  />
                  <textarea
                    value={editBack}
                    onChange={(e) => setEditBack(e.target.value)}
                    rows={1}
                    className="text-xs text-muted-foreground bg-transparent outline-none w-full resize-none field-sizing-content"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEditCard(); }
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
                      onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id); }}
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
