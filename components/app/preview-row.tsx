import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type React from "react";

import { cn } from "@/lib/utils";

// The roomier sibling of ListRow for the cozy list density: a thumbnail (or
// icon) on the left, title with a quiet meta line ("Added 2d ago"), and the
// trailing slot (star) pinned to the row's top-right, card-style. Same
// hover/selected registers as ListRow.
export const PreviewRow = ({
  leading,
  title,
  meta,
  trailing,
  selected,
  muted,
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & {
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  selected?: boolean;
  muted?: boolean;
}) =>
  useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "group/row flex items-center gap-2 rounded-control px-2 py-1.5 outline-none select-none hover:bg-foreground/[0.05] focus-visible:bg-foreground/[0.05] data-[selected]:bg-foreground/[0.07]",
          muted ? "text-foreground opacity-50" : "text-foreground",
          className,
        ),
        children: (
          <>
            {leading && <span className="shrink-0">{leading}</span>}
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              <span className="fade-r min-w-0 font-content text-body">
                {title}
              </span>
              {meta && (
                <span className="truncate text-micro text-muted-foreground">
                  {meta}
                </span>
              )}
            </span>
            {trailing && (
              <span className="flex self-start pt-1">{trailing}</span>
            )}
          </>
        ),
      },
      props,
    ),
    render,
    state: { slot: "preview-row", selected: Boolean(selected) },
  });
