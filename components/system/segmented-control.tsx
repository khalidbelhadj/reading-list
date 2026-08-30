import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import React from "react";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
};

// One-of-few choice shown in full: a quiet track with the chosen segment
// raised. Two to five options; more than that is a Select.
export const SegmentedControl = <T extends string>({
  value,
  onValueChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  "aria-label"?: string;
}) => {
  // ToggleGroup speaks in arrays; a segmented control always has exactly one
  // pressed segment, and pressing it again must not clear the choice.
  const handleChange = React.useCallback(
    (next: unknown[]) => {
      const picked = next[0];
      if (typeof picked === "string" && picked !== value)
        onValueChange(picked as T);
    },
    [onValueChange, value],
  );

  return (
    <ToggleGroup
      value={[value]}
      onValueChange={handleChange}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-7 w-fit items-center gap-0.5 rounded-control bg-foreground/[0.05] p-0.5",
        className,
      )}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className="flex h-full items-center rounded-[calc(var(--r-control)-2px)] px-2.5 text-body font-medium text-muted-foreground outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-[0_1px_2px_rgb(0_0_0/0.08)]"
        >
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
};
