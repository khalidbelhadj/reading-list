import { IconX } from "@tabler/icons-react";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const splitTags = (raw: string) =>
  raw
    .split(/[,\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

const TagBadge = ({
  tag,
  selected,
  onRemove,
}: {
  tag: string;
  selected: boolean;
  onRemove: (tag: string) => void;
}) => {
  const handleRemove = React.useCallback(() => {
    onRemove(tag);
  }, [onRemove, tag]);

  return (
    <Badge
      variant="secondary"
      className={cn(selected && "bg-primary text-primary-foreground")}
    >
      {tag}
      <Button
        variant="ghost"
        size="icon"
        data-icon="inline-end"
        onClick={handleRemove}
        aria-label={`Remove ${tag}`}
        className={cn(
          "size-auto p-0 transition-colors",
          selected
            ? "text-primary-foreground/70 hover:text-primary-foreground"
            : "text-muted-foreground/60 hover:text-foreground",
        )}
      >
        <IconX className="size-2.5" />
      </Button>
    </Badge>
  );
};

export const TagInput = ({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) => {
  const [input, setInput] = React.useState("");
  const [allSelected, setAllSelected] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addTags = React.useCallback(
    (raws: string[]) => {
      if (raws.length === 0) return;
      const next = [...value];
      for (const raw of raws) {
        const tag = raw.trim().toLowerCase();
        if (tag && !next.includes(tag)) next.push(tag);
      }
      if (next.length !== value.length) onChange(next);
      setInput("");
    },
    [value, onChange],
  );

  const handleRemoveTag = React.useCallback(
    (tag: string) => {
      onChange(value.filter((t) => t !== tag));
    },
    [value, onChange],
  );

  const handleWrapperClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (allSelected) setAllSelected(false);
      if (e.target === e.currentTarget) inputRef.current?.focus();
    },
    [allSelected],
  );

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (allSelected) setAllSelected(false);
      const v = e.target.value;
      if (v.includes(",")) addTags(splitTags(v));
      else setInput(v);
    },
    [addTags, allSelected],
  );

  const handleInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key.toLowerCase() === "a" && !input && value.length > 0) {
        e.preventDefault();
        setAllSelected(true);
        return;
      }
      if (e.key === "Escape" && allSelected) {
        e.preventDefault();
        setAllSelected(false);
        return;
      }
      if (allSelected && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        onChange([]);
        setAllSelected(false);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        addTags([input]);
        return;
      }
      if (e.key === "Backspace" && !input && value.length > 0) {
        onChange(value.slice(0, -1));
      }
    },
    [addTags, input, value, onChange, allSelected],
  );

  const handleCopy = React.useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (!allSelected || value.length === 0) return;
      e.preventDefault();
      e.clipboardData.setData("text/plain", value.join(", "));
    },
    [allSelected, value],
  );

  const handleCut = React.useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (!allSelected || value.length === 0) return;
      e.preventDefault();
      e.clipboardData.setData("text/plain", value.join(", "));
      onChange([]);
      setAllSelected(false);
    },
    [allSelected, value, onChange],
  );

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text || (!text.includes(",") && !text.includes("\n"))) return;
      e.preventDefault();
      addTags(splitTags(text));
    },
    [addTags],
  );

  const handleBlur = React.useCallback(() => {
    setAllSelected(false);
  }, []);

  return (
    <div
      className="flex flex-wrap items-center gap-1 min-h-5 cursor-text"
      onClick={handleWrapperClick}
    >
      {value.map((tag) => (
        <TagBadge
          key={tag}
          tag={tag}
          selected={allSelected}
          onRemove={handleRemoveTag}
        />
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onCopy={handleCopy}
        onCut={handleCut}
        onPaste={handlePaste}
        onBlur={handleBlur}
        placeholder={value.length === 0 ? "Tags..." : ""}
        className="text-sm bg-transparent outline-none min-w-8 flex-1 h-5 placeholder:text-muted-foreground/30"
      />
    </div>
  );
};
