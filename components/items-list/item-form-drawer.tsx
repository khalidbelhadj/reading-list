import Image from "next/image";
import React from "react";
import { IconGlobe, IconWand, IconX } from "@tabler/icons-react";

import { type Item } from "@/lib/types";
import { type EditFields, getFaviconSrc } from "./utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAutofill } from "./use-autofill";

export function ItemFormDrawer({
  open,
  isNew,
  item,
  onSave,
  onCancel,
  onDelete,
}: {
  open: boolean;
  isNew: boolean;
  item: Item | null;
  onSave: (fields: EditFields) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const { showAutofill, fetching, handleAutofill, onUrlPaste } = useAutofill(url, title, setTitle);

  React.useEffect(() => {
    if (open) {
      setTitle(item?.title ?? "");
      setUrl(item?.url ?? "");
      setTagsInput(item?.tags.map((t) => t.name).join(", ") ?? "");
      setNotes(item?.notes ?? "");
    }
  }, [open, item]);

  if (!open) return null;

  const faviconSrc = item ? getFaviconSrc(item) : null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button type="button" onClick={onCancel} className="text-muted-foreground">
          <IconX className="size-5" />
        </button>
        <span className="text-sm font-medium">{isNew ? "Add item" : "Edit item"}</span>
        <Button
          size="sm"
          onClick={() => onSave({ title, url, tags: tagsInput, notes })}
        >
          Save
        </Button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="size-6 shrink-0 flex items-center justify-center">
            {faviconSrc ? (
              <Image
                src={faviconSrc}
                alt=""
                width={24}
                height={24}
                className="size-6 rounded"
                unoptimized
              />
            ) : (
              <IconGlobe className="size-6 text-muted-foreground" />
            )}
          </div>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="flex-1 min-w-0 text-base bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {showAutofill && (
            <button
              type="button"
              className="shrink-0 text-muted-foreground/50 active:text-foreground"
              onClick={handleAutofill}
              disabled={fetching}
            >
              {fetching ? <Spinner className="size-4" /> : <IconWand className="size-4" />}
            </button>
          )}
        </div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={onUrlPaste}
          placeholder="https://example.com"
          className="text-base text-muted-foreground/70 bg-transparent outline-none placeholder:text-muted-foreground/40"
        />
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Tags (comma-separated)"
          className="text-sm text-muted-foreground/50 bg-transparent outline-none placeholder:text-muted-foreground/30"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes..."
          rows={4}
          className="text-base text-muted-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/40"
        />
        {onDelete && (
          <Button
            variant="destructive"
            className="mt-auto"
            onClick={() => onDelete()}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
