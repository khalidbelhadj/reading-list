import React from "react";

import { cn } from "@/lib/utils";

// Text that edits in place. It renders as whatever text it sits in (a title,
// a row label, a URL): same font, size and wrapping, and nothing happens on
// hover or focus beyond the text cursor and the caret. Enter commits (single
// line), Escape reverts, blur commits. The caller owns the value; `onCommit`
// fires when editing ends.
export const EditableText = ({
  value,
  onChange,
  onCommit,
  placeholder,
  multiline = false,
  disabled = false,
  autoFocus = false,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  // Focus on mount with the caret at the end — for fields that appear
  // already in editing (an inline URL editor).
  autoFocus?: boolean;
  className?: string;
  "aria-label"?: string;
}) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const valueBeforeEdit = React.useRef(value);

  const autoFocusRef = React.useRef(autoFocus);
  React.useEffect(() => {
    const element = ref.current;
    if (!autoFocusRef.current || !element) return;
    element.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  // Push external value changes into the DOM without clobbering the caret
  // while the user types: only when the text actually differs.
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (element && element.textContent !== value) element.textContent = value;
  }, [value]);

  const handleInput = React.useCallback(
    (event: React.FormEvent<HTMLSpanElement>) => {
      const element = event.currentTarget;
      const text = element.textContent ?? "";
      // Backspacing the last character leaves a stray <br> in the
      // contenteditable, which defeats the :empty placeholder — clear it so
      // the element is truly empty again.
      if (text === "" && element.firstChild) element.replaceChildren();
      onChange(multiline ? text : text.replace(/\n/g, ""));
    },
    [onChange, multiline],
  );

  const handleFocus = React.useCallback(() => {
    valueBeforeEdit.current = value;
  }, [value]);

  const handleBlur = React.useCallback(() => {
    onCommit?.(ref.current?.textContent ?? "");
  }, [onCommit]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLSpanElement>) => {
      if (event.key === "Enter" && (!multiline || event.metaKey)) {
        event.preventDefault();
        event.currentTarget.blur();
      } else if (event.key === "Escape") {
        event.preventDefault();
        // Capture the element now — React nulls currentTarget once the
        // handler returns, so reading it inside the rAF finds nothing (and
        // the field would silently stay focused).
        const element = event.currentTarget;
        onChange(valueBeforeEdit.current);
        // Blur after React has written the reverted value back.
        requestAnimationFrame(() => element.blur());
      }
    },
    [multiline, onChange],
  );

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLSpanElement>) => {
      // Plain text only: pasted markup would otherwise land in the span.
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      document.execCommand(
        "insertText",
        false,
        multiline ? text : text.replace(/\n/g, " "),
      );
    },
    [multiline],
  );

  return (
    <span
      ref={ref}
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline={multiline}
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-slot="editable-text"
      data-placeholder={placeholder}
      spellCheck
      onInput={handleInput}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className={cn(
        "block min-w-8 cursor-text break-words outline-none",
        "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
        !multiline && "whitespace-pre-wrap [&_br]:hidden",
        disabled && "pointer-events-none",
        className,
      )}
    />
  );
};
