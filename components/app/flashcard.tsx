import MarkdownIt from "markdown-it";
import React from "react";

import { MarkdownEditor } from "@/components/system/markdown-editor";
import { cn } from "@/lib/utils";

// Card text is markdown. A side renders it through markdown-it with raw HTML
// OFF (anything HTML-shaped is escaped, so card content can't inject markup);
// clicking a side swaps in its markdown source for in-place editing, and blur
// renders it again. Deliberately lighter than a tiptap instance per side — a
// deck shows hundreds of cards.
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

// One side of the card: rendered markdown that becomes an editable source
// field on click (when the caller passes onChange — otherwise display only).
// There is no edit mode; the card is simply always a card.
// The editing state of a side: a real (WYSIWYG) markdown editor, mounted only
// while this side is being edited. Commits when focus leaves it.
const SideEditor = ({
  source,
  placeholder,
  onChange,
  onDone,
  className,
}: {
  source: string;
  placeholder: string;
  onChange: (value: string) => void;
  onDone: () => void;
  className?: string;
}) => {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const handleBlur = React.useCallback(
    (event: React.FocusEvent) => {
      // Focus moving within the editor (e.g. into a code block's controls)
      // is not a commit; leaving the wrapper entirely is.
      if (
        wrapperRef.current &&
        event.relatedTarget instanceof Node &&
        wrapperRef.current.contains(event.relatedTarget)
      )
        return;
      onDone();
    },
    [onDone],
  );

  // Focus events don't dispatch while the document itself is unfocused, so a
  // pointerdown outside the editor is the second, focus-independent commit
  // trigger. onDone is idempotent.
  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        onDone();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [onDone]);
  return (
    <div
      ref={wrapperRef}
      onBlur={handleBlur}
      className={cn("x-card-side-editor", className)}
    >
      <MarkdownEditor
        value={source}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus
      />
    </div>
  );
};

const Side = ({
  source,
  placeholder,
  onChange,
  onCommit,
  className,
  "aria-label": ariaLabel,
}: {
  source: string;
  placeholder: string;
  onChange?: (value: string) => void;
  onCommit?: () => void;
  className?: string;
  "aria-label": string;
}) => {
  const [editing, setEditing] = React.useState(false);

  const handleCommit = React.useCallback(() => {
    setEditing(false);
    onCommit?.();
  }, [onCommit]);

  if (onChange && editing) {
    return (
      <SideEditor
        source={source}
        placeholder={placeholder}
        onChange={onChange}
        onDone={handleCommit}
        className={className}
      />
    );
  }

  if (!source.trim()) {
    return (
      <span
        role={onChange ? "button" : undefined}
        aria-label={ariaLabel}
        onClick={onChange ? () => setEditing(true) : undefined}
        className={cn(
          "text-muted-foreground/60",
          onChange && "cursor-text",
          className,
        )}
      >
        {placeholder}
      </span>
    );
  }

  return (
    <div
      aria-label={ariaLabel}
      onClick={onChange ? () => setEditing(true) : undefined}
      className={cn("x-md", onChange && "cursor-text", className)}
      // Safe: markdown-it with html:false escapes any embedded HTML.
      dangerouslySetInnerHTML={{ __html: md.render(source) }}
    />
  );
};

/**
 * The flashcard ("Sheet", chosen on the board, round 10): one quiet surface,
 * the answer unfolding beneath the front behind a hairline. Sides render
 * markdown and edit in place on click — no edit mode, no pencil. Reveal is
 * click-to-toggle on the "Show answer" hint by default, or controlled via
 * `revealed` (review owns it). Presentation only: text and callbacks come
 * from the caller; omit the change handlers for a display-only card.
 */
export const Flashcard = ({
  front,
  back,
  scale = "list",
  revealed,
  onRevealedChange,
  onFrontChange,
  onBackChange,
  onCommit,
  className,
}: {
  front: string;
  back: string;
  scale?: "review" | "list";
  // Controlled reveal (review owns it); omit for click-to-reveal.
  revealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  onFrontChange?: (front: string) => void;
  onBackChange?: (back: string) => void;
  // Fired when an in-place edit of either side ends (the save point).
  onCommit?: () => void;
  className?: string;
}) => {
  const [internalRevealed, setInternalRevealed] = React.useState(false);
  const isRevealed = revealed ?? internalRevealed;

  const revealAnswer = React.useCallback(() => {
    setInternalRevealed(true);
    onRevealedChange?.(true);
  }, [onRevealedChange]);

  return (
    <div
      data-slot="flashcard"
      className={cn(
        "flex w-full flex-col rounded-surface bg-foreground/[0.03]",
        scale === "review" ? "gap-3 p-6" : "gap-2 p-4",
        className,
      )}
    >
      <Side
        source={front}
        placeholder="Front"
        aria-label="Front"
        onChange={onFrontChange}
        onCommit={onCommit}
        className={cn(
          "font-content font-medium",
          scale === "review" ? "text-title" : "text-body",
        )}
      />
      {isRevealed ? (
        <>
          <div className="h-px bg-foreground/10" />
          <Side
            source={back}
            placeholder="Back"
            aria-label="Back"
            onChange={onBackChange}
            onCommit={onCommit}
            className={cn(
              "font-content text-muted-foreground",
              scale === "review" ? "text-body" : "text-small",
            )}
          />
        </>
      ) : (
        <span
          role="button"
          onClick={revealAnswer}
          className="cursor-pointer text-small text-muted-foreground/60 select-none"
        >
          Show answer
        </span>
      )}
    </div>
  );
};
