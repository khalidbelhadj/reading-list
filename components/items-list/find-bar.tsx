"use client";

import React from "react";
import { IconChevronDown, IconChevronUp, IconX } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { isModKey } from "@/lib/input-context";
import { Button } from "@/components/ui/button";
import type { PanelFind } from "./use-panel-find";

export const FindBar = ({ find }: { find: PanelFind }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus and select-all on open or re-open.
  React.useEffect(() => {
    if (!find.isOpen) return;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [find.isOpen]);

  // Re-focus the input when the user hits Cmd+F while the bar is already
  // open — the global listener flips isOpen→true (a no-op state-wise), so
  // we need a separate listener here to refocus.
  React.useEffect(() => {
    if (!find.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (isModKey(e) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [find.isOpen]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        find.close();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) find.prev();
        else find.next();
      }
    },
    [find],
  );

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      find.setQuery(e.target.value);
    },
    [find],
  );

  if (!find.isOpen) return null;

  const hasMatches = find.total > 0;
  const hasQuery = find.query.length > 0;

  return (
    <div
      data-find-bar
      className="absolute top-10 right-3 z-30 flex items-center gap-1 rounded-md border border-border bg-surface/95 p-1 shadow-md backdrop-blur-sm [&>button+button]:-ml-1"
    >
      <input
        ref={inputRef}
        value={find.query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Find"
        className="w-40 bg-transparent px-1.5 text-sm outline-none"
      />
      <span
        className={cn(
          "px-1 text-xs tabular-nums select-none",
          hasQuery && !hasMatches
            ? "text-destructive"
            : "text-muted-foreground",
        )}
      >
        {hasQuery
          ? `${hasMatches ? find.currentIndex + 1 : 0}/${find.total}`
          : ""}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        onClick={find.prev}
        disabled={!hasMatches}
        aria-label="Previous match"
      >
        <IconChevronUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        onClick={find.next}
        disabled={!hasMatches}
        aria-label="Next match"
      >
        <IconChevronDown />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        onClick={find.close}
        aria-label="Close find"
      >
        <IconX />
      </Button>
    </div>
  );
};
