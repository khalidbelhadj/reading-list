import { IconX } from "@tabler/icons-react";
import React from "react";

import { Badge } from "@/components/ui/badge";

const TagBadge = ({
  tag,
  onRemove,
}: {
  tag: string;
  onRemove: (tag: string) => void;
}) => {
  const handleRemove = React.useCallback(() => {
    onRemove(tag);
  }, [onRemove, tag]);

  return (
    <Badge variant="secondary">
      {tag}
      <button
        type="button"
        data-icon="inline-end"
        onClick={handleRemove}
        aria-label={`Remove ${tag}`}
        className="text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <IconX className="size-2.5" />
      </button>
    </Badge>
  );
};

export function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addTag = React.useCallback(
    (raw: string) => {
      const tag = raw.trim().toLowerCase();
      if (tag && !value.includes(tag)) {
        onChange([...value, tag]);
      }
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
      if (e.target === e.currentTarget) inputRef.current?.focus();
    },
    [],
  );

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (v.includes(",")) {
        v.split(",").forEach(addTag);
      } else {
        setInput(v);
      }
    },
    [addTag],
  );

  const handleInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addTag(input);
      }
      if (e.key === "Backspace" && !input && value.length > 0) {
        onChange(value.slice(0, -1));
      }
    },
    [addTag, input, value, onChange],
  );

  return (
    <div
      className="flex flex-wrap items-center gap-1 min-h-5 cursor-text"
      onClick={handleWrapperClick}
    >
      {value.map((tag) => (
        <TagBadge key={tag} tag={tag} onRemove={handleRemoveTag} />
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        placeholder={value.length === 0 ? "Tags..." : ""}
        className="text-xs bg-transparent outline-none min-w-8 flex-1 h-5 placeholder:text-muted-foreground/30"
      />
    </div>
  );
}
