"use client";

import React from "react";

import { highlightLatex } from "@/lib/highlight-latex";

// A syntax-highlighted LaTeX source field: a transparent <textarea> stacked
// exactly over a highlighted <pre> (the caret/selection come from the textarea,
// the colors from the pre). Shared by the block-math editor (in-flow) and the
// inline-math popover. See app/globals.css `.latex-source` for the styles.
type LatexSourceFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
};

export const LatexSourceField = React.forwardRef<
  HTMLTextAreaElement,
  LatexSourceFieldProps
>(({ value, onChange, onKeyDown, onBlur, placeholder }, ref) => {
  // Pad a trailing space when the source ends in a newline so the highlight
  // layer keeps the same height as the textarea's reserved final line.
  const highlighted = highlightLatex(value) + (value.endsWith("\n") ? " " : "");
  return (
    <div className="latex-source">
      <pre className="latex-source__pre" aria-hidden="true">
        <code
          className="hljs"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
      <textarea
        ref={ref}
        className="latex-source__textarea"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onMouseDown={(event) => event.stopPropagation()}
      />
    </div>
  );
});

LatexSourceField.displayName = "LatexSourceField";
