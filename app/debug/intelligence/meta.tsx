// Generic "label: value" metadata display. A row of compact pairs — muted
// label, mono value — that wraps. Used wherever a bit of structured metadata
// needs to read cleanly without hand-styling each spot (model picker,
// detail pane, …).
import type React from "react";

import { cn } from "@/lib/utils";

export const Meta = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs",
      className,
    )}
  >
    {children}
  </div>
);

export const MetaPair = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <span className="inline-flex items-baseline gap-1">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono text-foreground/80">{value}</span>
  </span>
);
