"use client";

import React from "react";

import { cn } from "@/lib/utils";

// Plain-text contenteditable wrapper. Behaves like a one-way-bound input:
// the parent owns the value, the element syncs to it when the external
// value diverges from textContent (e.g. item switch, autofill animation).
// During normal typing the DOM is already in sync, so no re-sync fires and
// the caret is preserved.
//
// Why not just `<textarea>` / `<input>`? Those can't contain inline DOM, so
// any rich find-highlighting (rounded marks, ProseMirror-style decorations)
// is impossible inside them. Contenteditable lets us treat title/URL the
// same as the rest of the panel's text.

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  // Strip newlines on paste, preventDefault Enter. Title and URL both use this.
  singleLine?: boolean;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  spellCheck?: boolean;
  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  // Pass-through data attributes so callers can keep their existing selectors.
  "data-detail-title"?: boolean;
};

export const PlainEditable = React.forwardRef<HTMLDivElement, Props>(
  (
    {
      value,
      onChange,
      placeholder,
      singleLine,
      className,
      style,
      autoFocus,
      spellCheck,
      onPaste,
      onKeyDown,
      ...rest
    },
    forwardedRef,
  ) => {
    const innerRef = React.useRef<HTMLDivElement | null>(null);
    const setRefs = React.useCallback(
      (el: HTMLDivElement | null) => {
        innerRef.current = el;
        if (typeof forwardedRef === "function") forwardedRef(el);
        else if (forwardedRef) forwardedRef.current = el;
      },
      [forwardedRef],
    );

    // Seed initial content + autofocus once, then sync external value →
    // DOM whenever they diverge (item switch, autofill animation,
    // programmatic resets). During user typing the values stay equal, so
    // this no-ops and the caret never jumps.
    //
    // useLayoutEffect so the morph measurements that run on first paint
    // already see the populated text.
    const didFocusRef = React.useRef(false);
    React.useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      if (el.textContent !== value) el.textContent = value;
      if (autoFocus && !didFocusRef.current) {
        didFocusRef.current = true;
        el.focus();
        // Place caret at end for a natural feel when opening a new item.
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, [value, autoFocus]);

    const handleInput = React.useCallback(
      (e: React.FormEvent<HTMLDivElement>) => {
        let text = e.currentTarget.textContent ?? "";
        if (singleLine) text = text.replace(/\n/g, "");
        onChange(text);
      },
      [onChange, singleLine],
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (singleLine && e.key === "Enter") {
          e.preventDefault();
        }
        onKeyDown?.(e);
      },
      [singleLine, onKeyDown],
    );

    // Always paste as plain text — contenteditable's default rich-text paste
    // would inject styled spans / tables / line breaks into a field that's
    // supposed to be a single string.
    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        let text = e.clipboardData.getData("text/plain");
        if (singleLine) text = text.replace(/\n/g, "");
        // execCommand("insertText") is deprecated but remains the only way
        // to insert text at the caret while keeping undo history intact.
        document.execCommand("insertText", false, text);
        onPaste?.(e);
      },
      [singleLine, onPaste],
    );

    return (
      <div
        ref={setRefs}
        contentEditable
        suppressContentEditableWarning
        spellCheck={spellCheck}
        role="textbox"
        aria-multiline={!singleLine}
        data-placeholder={placeholder}
        className={cn("ce-placeholder outline-none", className)}
        style={style}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        {...rest}
      />
    );
  },
);

PlainEditable.displayName = "PlainEditable";
