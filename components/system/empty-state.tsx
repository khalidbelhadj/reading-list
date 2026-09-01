import type React from "react";

import { cn } from "@/lib/utils";

// The block behind every empty, error and not-found moment: a title, a quiet
// line of context, and optionally the one action that resolves it.
export const EmptyState = ({
  title,
  description,
  action,
  tone = "default",
  align = "center",
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "default" | "error";
  align?: "start" | "center";
  className?: string;
}) => (
  <div
    data-slot="empty-state"
    className={cn(
      "flex flex-col gap-1",
      align === "center" ? "items-center text-center" : "items-start text-left",
      // Placeholder copy is chrome; error text stays copyable.
      tone !== "error" && "select-none",
      className,
    )}
  >
    <p
      className={cn(
        "text-body font-medium",
        tone === "error" ? "text-destructive" : "text-foreground",
      )}
    >
      {title}
    </p>
    {description && (
      <p
        className={cn(
          "max-w-xs text-body",
          tone === "error" ? "text-destructive/70" : "text-muted-foreground",
        )}
      >
        {description}
      </p>
    )}
    {action && <div className="pt-3">{action}</div>}
  </div>
);
