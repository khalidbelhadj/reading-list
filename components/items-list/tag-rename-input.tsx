import React from "react";

import { type DbTag } from "@/lib/types";

export const TagRenameInput = ({
  tag,
  value,
  onChange,
  onCommit,
  onCancel,
  stopClickPropagation = false,
}: {
  tag: DbTag;
  value: string;
  onChange: (next: string) => void;
  onCommit: (tag: DbTag) => void;
  onCancel: () => void;
  stopClickPropagation?: boolean;
}) => {
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const handleBlur = React.useCallback(() => {
    onCommit(tag);
  }, [onCommit, tag]);

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      if (stopClickPropagation) e.stopPropagation();
    },
    [stopClickPropagation],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onCommit(tag);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    },
    [onCommit, onCancel, tag],
  );

  return (
    <input
      autoFocus
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      size={Math.max(value.length, 1)}
      className="field-sizing-content h-5 rounded-md bg-badge px-2 text-[0.625rem] font-medium text-badge-foreground ring-1 ring-foreground/20 outline-none"
    />
  );
};
