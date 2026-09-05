import type React from "react";

import { cn } from "@/lib/utils";

import { Tooltip } from "./tooltip";

// What a column can be painted with: the accent for the one series a chart
// is about, muted for context, destructive for the "went wrong" state.
export type ColumnTone = "accent" | "muted" | "destructive";

const TONE_CLASS: Record<ColumnTone, string> = {
  accent: "bg-primary group-hover/column:bg-primary/80",
  muted: "bg-foreground/25 group-hover/column:bg-foreground/40",
  destructive: "bg-destructive group-hover/column:bg-destructive/80",
};

const TONE_SWATCH: Record<ColumnTone, string> = {
  accent: "bg-primary",
  muted: "bg-foreground/25",
  destructive: "bg-destructive",
};

export type ChartColumn = {
  key: string;
  value: number;
  // Under the column, on the axis. Keep it short; it truncates.
  label?: React.ReactNode;
  // On the column's cap. Selective: the extreme, the latest, never all.
  valueLabel?: React.ReactNode;
  // Hover detail for the column.
  tooltip?: React.ReactNode;
  tone?: ColumnTone;
};

// A single-series column chart: thin columns with a rounded cap, growing from
// one hairline baseline, a 2px surface gap between neighbours, and a hover
// tooltip per column. Columns cap at 24px thick and the slot's leftover is
// air. Data only; the caller decides bins, order, and which column gets a
// label.
export const ColumnChart = ({
  columns,
  max,
  height = 96,
  className,
  "aria-label": ariaLabel,
}: {
  columns: ChartColumn[];
  // The value that fills the full height; defaults to the tallest column.
  max?: number;
  height?: number;
  className?: string;
  "aria-label"?: string;
}) => {
  const top = max ?? Math.max(1, ...columns.map((column) => column.value));
  const hasLabels = columns.some((column) => column.label !== undefined);
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      data-slot="column-chart"
      className={cn("flex w-full flex-col", className)}
    >
      <div className="flex items-end gap-0.5" style={{ height }}>
        {columns.map((column) => {
          const fraction = Math.max(0, Math.min(1, column.value / top));
          const slot = (
            <div
              key={column.key}
              className="group/column flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            >
              {column.valueLabel !== undefined && (
                <span className="mb-1 text-micro text-muted-foreground tabular-nums select-none">
                  {column.valueLabel}
                </span>
              )}
              <div
                className={cn(
                  "w-full max-w-6 rounded-t-[4px] transition-colors",
                  TONE_CLASS[column.tone ?? "accent"],
                )}
                style={{
                  height: `${fraction * 100}%`,
                  // A non-zero value always leaves a mark.
                  minHeight: column.value > 0 ? 2 : 0,
                }}
              />
            </div>
          );
          return column.tooltip !== undefined ? (
            <Tooltip key={column.key} content={column.tooltip}>
              {slot}
            </Tooltip>
          ) : (
            slot
          );
        })}
      </div>
      <div className="h-px bg-foreground/10" />
      {hasLabels && (
        <div className="mt-1 flex gap-0.5">
          {columns.map((column) => (
            <span
              key={column.key}
              className="min-w-0 flex-1 truncate text-center text-micro text-muted-foreground tabular-nums select-none"
            >
              {column.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// The identity key for a chart with more than one tone. A swatch and a word
// per entry; text stays in text tokens, the swatch carries the colour.
export const ChartLegend = ({
  items,
  className,
}: {
  items: Array<{ tone: ColumnTone; label: React.ReactNode }>;
  className?: string;
}) => (
  <div
    data-slot="chart-legend"
    className={cn(
      "flex items-center gap-3 text-small text-muted-foreground select-none",
      className,
    )}
  >
    {items.map((item, index) => (
      <span key={index} className="flex items-center gap-1.5">
        <span className={cn("size-2 rounded-[2px]", TONE_SWATCH[item.tone])} />
        {item.label}
      </span>
    ))}
  </div>
);
