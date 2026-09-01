import type React from "react";

import { cn } from "@/lib/utils";

// Label, control, and a line of hint or error underneath. Vertical is the
// form default; horizontal puts the label left and the control right, for
// settings rows with a Switch or a Select.
export const Field = ({
  label,
  hint,
  error,
  orientation = "vertical",
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  orientation?: "vertical" | "horizontal";
  className?: string;
  children: React.ReactNode;
}) => {
  const note = error ?? hint;
  return (
    <label
      data-slot="field"
      className={cn(
        // Label and note are chrome; the control inside stays editable.
        "flex select-none",
        orientation === "vertical"
          ? "flex-col gap-1.5"
          : "min-h-row items-center justify-between gap-6",
        className,
      )}
    >
      <span
        className={cn(
          "flex flex-col",
          orientation === "vertical" ? "gap-1.5" : "gap-0.5",
        )}
      >
        <span
          className={cn(
            orientation === "vertical"
              ? "text-small font-medium text-muted-foreground"
              : "text-body text-foreground",
          )}
        >
          {label}
        </span>
        {orientation === "horizontal" && note && (
          <span
            className={cn(
              "text-small",
              error ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {note}
          </span>
        )}
      </span>
      {children}
      {orientation === "vertical" && note && (
        <span
          className={cn(
            "text-small",
            error ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {note}
        </span>
      )}
    </label>
  );
};
