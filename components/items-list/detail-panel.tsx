import {
  IconCheck,
  IconExternalLink,
  IconFileFilled,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import React from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Item } from "@/lib/types";

import { isModKey, isOverlayOpen, isTypingContext } from "@/lib/input-context";

import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { PlainEditable } from "./plain-editable";
import { TagInput } from "./tag-input";
import { useAutofill } from "./use-autofill";
import { type EditFields, getFaviconSrc } from "./utils";

// Order-independent key for dirty-tracking tag lists. Tags can change shape
// from outside the panel (rename/delete via the filter bar) and the server
// may return them in any order — compare as a sorted set, not a sequence.
const tagsKey = (names: string[]) => [...names].sort().join(", ");

export const DetailPanel = React.forwardRef<
  HTMLDivElement,
  {
    item: Item | null;
    isNew: boolean;
    defaultTags?: string[];
    onSave: (itemId: string, fields: EditFields) => void;
    onCreate: (fields: EditFields) => void;
    onCancel?: () => void;
    onDelete?: () => void;
    onFieldsChange?: (
      fields: {
        title: string;
        url: string;
        notes: string;
        tags: string[];
      } | null,
    ) => void;
    isSaving?: boolean;
  }
>(
  (
    {
      item,
      isNew,
      defaultTags,
      onSave,
      onCreate,
      onCancel,
      onDelete,
      onFieldsChange,
      isSaving = false,
    },
    ref,
  ) => {
    // Form state — initialize from item synchronously so the first paint
    // already has the populated values (avoids a layout shift on mount).
    const [title, setTitle] = React.useState(() => item?.title ?? "");
    const [url, setUrl] = React.useState(() => item?.url ?? "");
    const [tags, setTags] = React.useState<string[]>(
      () => item?.tags.map((t) => t.name) ?? (isNew ? (defaultTags ?? []) : []),
    );
    const [notes, setNotes] = React.useState(() => item?.notes ?? "");

    // Refs
    const titleRef = React.useRef<HTMLDivElement>(null);
    const urlInputRef = React.useRef<HTMLDivElement>(null);

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
    const { onUrlPaste } = useAutofill(url, title, setTitle);
    const currentId = item?.id ?? (isNew ? "new" : null);

    // Title autofocus for new items is handled by PlainEditable's autoFocus prop.

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
        if (isSaving) return;
        if (isOverlayOpen()) return;

        const panel = document.querySelector("[data-detail-panel]");
        if (!panel?.contains(e.target as Node)) return;

        if (e.key === "Enter" && isModKey(e)) {
          e.preventDefault();
          e.stopPropagation();
          const payload = tags.join(", ");
          if (isNew) {
            if (title.trim() || url.trim()) {
              onCreate({ title, url, tags: payload, notes });
            }
          } else if (currentId) {
            onSave(currentId, { title, url, tags: payload, notes });
            lastSavedRef.current = { title, url, tags: tagsKey(tags), notes };
          }
        }
        if (e.key === "Backspace" && isModKey(e) && onDelete) {
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
      isSaving,
      currentId,
      isNew,
    ]);

    // Callbacks
    const handleSetTitle = React.useCallback(
      (next: string) => setTitle(next.replace(/\n/g, "")),
      [],
    );

    const handleSetUrl = React.useCallback((next: string) => setUrl(next), []);

    const handleSave = React.useCallback(() => {
      if (title.trim() || url.trim()) {
        onCreate({ title, url, tags: tags.join(", "), notes });
      }
    }, [notes, onCreate, tags, title, url]);

    const faviconSrc = getFaviconSrc({
      faviconUrl: item?.faviconUrl ?? null,
      url,
    });

    return (
      <div
        ref={ref}
        data-detail-panel
        className="flex flex-1 flex-col gap-2 w-full pb-12"
      >
        {/* Item form card */}
        <div className="flex flex-col gap-2 flex-1">
          {/* Favicon + Title */}
          <div data-title-row className="relative">
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 inline-flex h-[30px] w-6 items-center justify-center overflow-hidden pointer-events-none"
            >
              {faviconSrc ? (
                <Image
                  src={faviconSrc}
                  alt=""
                  width={24}
                  height={24}
                  className="size-6 rounded-sm"
                  unoptimized
                />
              ) : (
                <IconFileFilled className="size-6 text-muted-foreground" />
              )}
            </span>
            <PlainEditable
              ref={titleRef}
              data-detail-title
              value={title}
              onChange={handleSetTitle}
              singleLine
              autoFocus={isNew}
              placeholder="Untitled"
              spellCheck
              style={{ textIndent: "2rem" }}
              className="font-content block w-full text-xl font-semibold leading-tight bg-transparent placeholder:text-muted-foreground break-words"
            />
            {isNew && (
              <>
                {onCancel && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground/40 shrink-0 hover:text-foreground"
                          onClick={onCancel}
                        />
                      }
                    >
                      <IconX />
                    </TooltipTrigger>
                    <TooltipContent>Cancel</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground/50 shrink-0 -ml-2 hover:text-foreground"
                        disabled={isSaving}
                        onClick={handleSave}
                      />
                    }
                  >
                    {isSaving ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <IconCheck />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>Create item</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>

          {/* URL */}

          <div className="flex items-center gap-1">
            <PlainEditable
              ref={urlInputRef}
              value={url}
              onChange={handleSetUrl}
              onPaste={onUrlPaste}
              singleLine
              placeholder="https://example.com"
              style={
                {
                  // 40% opacity placeholder matches the prior <input>'s
                  // `placeholder:text-muted-foreground/40` styling.
                  "--ce-placeholder-color":
                    "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
                } as React.CSSProperties
              }
              className="min-w-0 text-sm text-muted-foreground/70 bg-transparent whitespace-nowrap overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
            />

            {item?.url && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground"
                      onClick={() => window.open(item.url, "_blank")}
                    />
                  }
                >
                  <IconExternalLink />
                </TooltipTrigger>
                <TooltipContent>Open URL</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Tags */}
          <TagInput value={tags} onChange={setTags} />

          {/* Notes */}
          <div
            className="flex-1 min-h-32 cursor-text flex flex-col"
            onClick={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest(".ProseMirror")) return;
              const editorEl =
                event.currentTarget.querySelector<HTMLElement>(".ProseMirror");
              if (!editorEl) return;
              editorEl.focus();
              const range = document.createRange();
              range.selectNodeContents(editorEl);
              range.collapse(false);
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
            }}
          >
            <MarkdownEditor
              value={notes}
              onChange={setNotes}
              placeholder="Notes"
              className="fill text-sm text-foreground"
            />
          </div>
        </div>

      </div>
    );
  },
);

DetailPanel.displayName = "DetailPanel";
