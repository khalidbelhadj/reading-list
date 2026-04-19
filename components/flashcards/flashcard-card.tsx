"use client";

import React from "react";
import {
  IconCopy,
  IconDots,
  IconMarkdown,
  IconTrash,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type FlashcardCardData = {
  id: string;
  front: string;
  back: string;
};

export const FlashcardCard = ({
  card,
  onUpdate,
  onDelete,
  deleting = false,
  footer,
}: {
  card: FlashcardCardData;
  onUpdate: (id: string, fields: { front?: string; back?: string }) => void;
  onDelete: (id: string) => void;
  deleting?: boolean;
  footer?: React.ReactNode;
}) => {
  const [editing, setEditing] = React.useState(false);
  const [editFront, setEditFront] = React.useState(card.front);
  const [editBack, setEditBack] = React.useState(card.back);
  const [focusField, setFocusField] = React.useState<"front" | "back">("front");

  const startEdit = React.useCallback(
    (field: "front" | "back") => {
      setEditFront(card.front);
      setEditBack(card.back);
      setFocusField(field);
      setEditing(true);
    },
    [card.front, card.back],
  );

  const saveAndClose = React.useCallback(() => {
    const front = editFront.trim();
    const back = editBack.trim();
    if (front && (front !== card.front || back !== card.back)) {
      onUpdate(card.id, { front, back });
    }
    setEditing(false);
  }, [editFront, editBack, card.front, card.back, card.id, onUpdate]);

  const handleFocusOut = React.useCallback(
    (e: React.FocusEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      if (editing) saveAndClose();
    },
    [editing, saveAndClose],
  );

  const handleEditorKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        saveAndClose();
        return true;
      }
    },
    [saveAndClose],
  );

  const handleFrontClick = React.useCallback(() => {
    startEdit("front");
  }, [startEdit]);

  const handleBackClick = React.useCallback(() => {
    startEdit("back");
  }, [startEdit]);

  return (
    <div
      className="font-content group relative rounded-lg bg-card px-4 py-3"
      onBlur={editing ? handleFocusOut : undefined}
    >
      <FlashcardDropdown card={card} deleting={deleting} onDelete={onDelete} />

      {editing ? (
        <div className="flex flex-col gap-0.5">
          <MarkdownEditor
            value={editFront}
            onChange={setEditFront}
            autoFocus={focusField === "front"}
            className="text-xs font-medium"
            onKeyDown={handleEditorKeyDown}
          />
          <MarkdownEditor
            value={editBack}
            onChange={setEditBack}
            placeholder="Back"
            autoFocus={focusField === "back"}
            className="text-xs text-muted-foreground"
            onKeyDown={handleEditorKeyDown}
          />
        </div>
      ) : (
        <>
          <div className="cursor-pointer" onClick={handleFrontClick}>
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
              <div className="cursor-pointer mt-0.5" onClick={handleBackClick}>
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

      {footer}
    </div>
  );
};

const FlashcardDropdown = ({
  card,
  deleting,
  onDelete,
}: {
  card: FlashcardCardData;
  deleting: boolean;
  onDelete: (cardId: string) => void;
}) => {
  const [lastCopied, setLastCopied] = React.useState<"id" | "markdown" | null>(
    null,
  );

  const markCopied = React.useCallback((kind: "id" | "markdown") => {
    setLastCopied(kind);
    setTimeout(() => setLastCopied(null), 2000);
  }, []);

  const handleCopyId = React.useCallback(() => {
    navigator.clipboard.writeText(card.id);
    markCopied("id");
  }, [card.id, markCopied]);

  const handleCopyMarkdown = React.useCallback(() => {
    const markdown = card.back ? `${card.front}\n\n${card.back}` : card.front;
    navigator.clipboard.writeText(markdown);
    markCopied("markdown");
  }, [card.front, card.back, markCopied]);

  const handleDelete = React.useCallback(() => {
    onDelete(card.id);
  }, [card.id, onDelete]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "z-20 absolute top-1 right-1 text-muted-foreground/30 hover:text-foreground hover:bg-accent",
              deleting
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 data-popup-open:opacity-100",
            )}
            disabled={deleting}
          >
            {deleting ? <Spinner className="size-3.5" /> : <IconDots />}
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={4}>
        <Tooltip open={lastCopied === "id"}>
          <TooltipTrigger
            render={
              <DropdownMenuItem closeOnClick={false} onClick={handleCopyId}>
                <IconCopy />
                Copy ID
              </DropdownMenuItem>
            }
          />
          <TooltipContent side="right">Copied</TooltipContent>
        </Tooltip>
        <Tooltip open={lastCopied === "markdown"}>
          <TooltipTrigger
            render={
              <DropdownMenuItem
                closeOnClick={false}
                onClick={handleCopyMarkdown}
              >
                <IconMarkdown />
                Copy as markdown
              </DropdownMenuItem>
            }
          />
          <TooltipContent side="right">Copied</TooltipContent>
        </Tooltip>
        <DropdownMenuItem variant="destructive" onClick={handleDelete}>
          <IconTrash />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
