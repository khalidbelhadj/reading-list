import { NumberField } from "@base-ui/react/number-field";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import type React from "react";

import { cn } from "@/lib/utils";

// A number with a handle. The leading label (or unit) is a scrub area: press
// and drag it sideways to change the value, like a numeric field in a design
// tool. Chevrons on the right step it; typing still works.
export const NumberInput = ({
  value,
  onValueChange,
  label,
  min,
  max,
  step = 1,
  largeStep,
  format,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  value: number | null;
  onValueChange: (value: number | null) => void;
  // The drag handle and what names the field: a short word, a unit, an icon.
  label?: React.ReactNode;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  format?: Intl.NumberFormatOptions;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) => (
  <NumberField.Root
    value={value}
    onValueChange={onValueChange}
    min={min}
    max={max}
    step={step}
    largeStep={largeStep}
    format={format}
    disabled={disabled}
    className={cn("inline-flex", className)}
  >
    <NumberField.Group className="flex h-7 w-full min-w-0 items-center rounded-control bg-foreground/[0.05] text-body text-foreground focus-within:ring-2 focus-within:ring-ring/40 hover:bg-foreground/[0.07] has-disabled:pointer-events-none has-disabled:opacity-50">
      {label !== undefined && (
        <NumberField.ScrubArea
          direction="horizontal"
          className="flex h-full shrink-0 cursor-ew-resize items-center pr-1.5 pl-2.5 text-small text-muted-foreground select-none [&>svg]:size-3.5"
        >
          {label}
          <NumberField.ScrubAreaCursor className="drop-shadow-sm">
            <CursorGlyph />
          </NumberField.ScrubAreaCursor>
        </NumberField.ScrubArea>
      )}
      <NumberField.Input
        aria-label={ariaLabel}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-foreground tabular-nums outline-none",
          label === undefined ? "pl-2.5" : "pl-0.5",
        )}
      />
      <div className="flex h-full shrink-0 flex-col justify-center pr-1.5 text-muted-foreground">
        <NumberField.Increment className="flex h-3 w-4 items-center justify-center rounded-[3px] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40">
          <IconChevronUp className="size-3" />
        </NumberField.Increment>
        <NumberField.Decrement className="flex h-3 w-4 items-center justify-center rounded-[3px] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40">
          <IconChevronDown className="size-3" />
        </NumberField.Decrement>
      </div>
    </NumberField.Group>
  </NumberField.Root>
);

// The custom cursor shown while scrubbing: a pair of arrows, like the native
// ew-resize cursor but visible over the frost and dark surfaces.
const CursorGlyph = () => (
  <svg
    width="26"
    height="14"
    viewBox="0 0 24 14"
    fill="none"
    className="text-foreground"
  >
    <path
      d="M19.5 1.5 23 7l-3.5 5.5M4.5 1.5 1 7l3.5 5.5M1 7h22"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
