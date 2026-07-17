import { IconArrowUpRight } from "@tabler/icons-react";
import { createPortal } from "react-dom";

import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Favicon } from "./favicon";
import { type DragToWindowState } from "./use-drag-to-window";

// EXPERIMENT: floating chip that follows the cursor during a tear-off drag.
// Offset from the pointer, and once outside the viewport it brightens + shows
// the "pop out" affordance so the release-to-open gesture reads clearly.
export const DragToWindowGhost = ({
  item,
  drag,
}: {
  item: Item;
  drag: DragToWindowState | null;
}) => {
  if (drag === null || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed z-[60] flex max-w-64 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm shadow-lg transition-colors",
        drag.outside
          ? "bg-primary text-primary-foreground"
          : "bg-surface text-foreground",
      )}
      style={{ left: drag.x + 14, top: drag.y + 10 }}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        <Favicon item={item} className="size-full" />
      </span>
      <span className="truncate font-content font-medium">
        {item.title || "Untitled"}
      </span>
      {drag.outside && <IconArrowUpRight className="size-4 shrink-0" />}
    </div>,
    document.body,
  );
};
