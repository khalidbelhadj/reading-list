import type * as React from "react";

import { cn } from "@/lib/utils";

type NonIdealStateTone = "default" | "error";
type NonIdealStateAlign = "start" | "center";
type NonIdealStateSize = "sm" | "lg";

type NonIdealStateProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  // `error` paints the title (and description) in the destructive color.
  tone?: NonIdealStateTone;
  // Cross-axis + text alignment of the block. Standalone pages tend to read
  // better left-aligned; in-app empty/error states sit centered in their slot.
  align?: NonIdealStateAlign;
  // Title scale: `lg` for standalone pages, `sm` for the compact in-app style
  // where the title matches the description's size.
  size?: NonIdealStateSize;
  // The element used for the title. Standalone pages pass `h1` for semantics.
  titleAs?: "h1" | "p";
  // Caller-supplied buttons. Variants stay with the caller so each surface
  // keeps its own emphasis.
  actions?: React.ReactNode;
  // `stretch` stacks full-width buttons (e.g. an OAuth consent screen); `row`
  // packs them inline along the block's alignment.
  actionsLayout?: "row" | "stretch";
  // Wrap the block in a full-viewport centering container. Convenience for the
  // standalone pages (error, 404, auth) that would otherwise repeat it.
  fullPage?: boolean;
  className?: string;
};

const ALIGN: Record<NonIdealStateAlign, string> = {
  start: "items-start text-left",
  center: "items-center text-center",
};

/**
 * Shared "non-ideal state" — the title + description + actions block behind
 * every empty, error, and not-found surface in the app. Tone, size, and
 * alignment let one component cover both the standalone pages and the compact
 * in-app states; the live playground lives at `app/debug/empty-states`.
 */
export const NonIdealState = ({
  title,
  description,
  tone = "default",
  align = "start",
  size = "lg",
  titleAs: TitleTag = "p",
  actions,
  actionsLayout = "row",
  fullPage = false,
  className,
}: NonIdealStateProps) => {
  const isError = tone === "error";

  const block = (
    <div
      className={cn(
        "flex w-full max-w-md flex-col gap-4",
        ALIGN[align],
        align === "center" && "mx-auto",
        className,
      )}
    >
      {(title || description) && (
        <div className={cn("flex w-full flex-col gap-1", ALIGN[align])}>
          {title && (
            <TitleTag
              className={cn(
                "font-content",
                size === "lg" ? "text-lg" : "text-sm",
                isError ? "text-destructive" : "text-foreground",
              )}
            >
              {title}
            </TitleTag>
          )}
          {description && (
            <p
              className={cn(
                "text-sm",
                isError ? "text-destructive/70" : "text-muted-foreground",
              )}
            >
              {description}
            </p>
          )}
        </div>
      )}
      {actions && (
        <div
          className={
            actionsLayout === "stretch"
              ? "flex w-full flex-col gap-2"
              : "flex items-center gap-2"
          }
        >
          {actions}
        </div>
      )}
    </div>
  );

  if (!fullPage) return block;

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div
        aria-hidden
        className="electron-top-bar-inset fixed inset-x-0 top-0 h-12"
      />
      {block}
    </div>
  );
};
