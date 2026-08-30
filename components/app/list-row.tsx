import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type React from "react";

import { cn } from "@/lib/utils";

// One row of a list: leading icon or favicon, title, optional meta on the
// right. A long title fades out at its right edge rather than ending in an
// ellipsis. `selected` is the keyboard cursor or open item; `muted` fades the
// whole row (read or done rows, favicon included — the classic treatment).
// Renders a div; pass `render` for a link or button.
export const ListRow = ({
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
          "group/row flex h-row items-center gap-2 rounded-control px-2 text-body outline-none select-none hover:bg-foreground/[0.05] focus-visible:bg-foreground/[0.05] data-[selected]:bg-foreground/[0.07]",
          muted ? "text-foreground opacity-50" : "text-foreground",
          className,
        ),
        children: (
          <>
            {leading && (
              <span className="flex size-3.5 shrink-0 items-center justify-center [&>svg]:size-3.5">
                {leading}
              </span>
            )}
            <span className="fade-r min-w-0 flex-1 font-content">{title}</span>
            {meta && (
              <span className="shrink-0 text-small text-muted-foreground tabular-nums">
                {meta}
              </span>
            )}
            {trailing}
          </>
        ),
      },
      props,
    ),
    render,
    state: { slot: "list-row", selected: Boolean(selected) },
  });
