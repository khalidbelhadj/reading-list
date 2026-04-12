import React from "react";
import { Badge } from "@/components/ui/badge";

export function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="cursor-pointer gap-0"
          render={<button type="button" onClick={() => removeTag(tag)} />}
        >
          {tag}
        </Badge>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(",")) {
            v.split(",").forEach(addTag);
          } else {
            setInput(v);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag(input);
          }
          if (e.key === "Backspace" && !input && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        placeholder={value.length === 0 ? "Tags..." : ""}
        className="text-xs bg-transparent outline-none min-w-8 flex-1 placeholder:text-muted-foreground/30"
      />
    </div>
  );
}
