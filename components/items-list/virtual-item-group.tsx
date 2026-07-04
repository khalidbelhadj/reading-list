import { IconChevronRight } from "@tabler/icons-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { VirtualItemList } from "./virtual-item-list";

type VirtualItemGroupProps = {
  items: Item[];
  // A fully custom header (badges, context menus, …). Overrides `title`/`count`.
  header?: React.ReactNode;
  // Convenience header: a chevron + label + count toggle, for standalone use.
  title?: React.ReactNode;
  count?: number;
  // Open state. Controlled when `open` is provided, otherwise self-managed.
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  scrollElementRef?: React.RefObject<HTMLElement | null>;
};

/**
 * A reusable, self-contained item group: a header plus a virtualized body that
 * windows its rows against the shared scroll viewport. Because it carries its
 * own collapse state and registers its rows via the nav registry (through
 * {@link VirtualItemList}), it can be dropped anywhere inside a
 * `VirtualScrollProvider` without living in the main items list.
 *
 * Collapsed groups render no body (instant collapse) so a huge group never
 * mounts its rows; height-animated collapse and virtualization don't mix.
 */
export const VirtualItemGroup = ({
  items,
  header,
  title,
  count,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  scrollElementRef,
}: VirtualItemGroupProps) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const toggle = React.useCallback(() => {
    if (isControlled) onOpenChange?.(!openProp);
    else setInternalOpen((prev) => !prev);
  }, [isControlled, onOpenChange, openProp]);

  return (
    <div className="flex flex-col">
      {header ?? (
        <Button
          variant="ghost"
          onClick={toggle}
          className="flex h-auto w-full items-center justify-start gap-1.5 rounded-lg p-1 text-left font-content text-sm outline-none hover:bg-muted"
        >
          <IconChevronRight
            className={cn(
              "size-3.5 text-muted-foreground transition-transform duration-100",
              open && "rotate-90",
            )}
          />
          <span className="truncate">{title}</span>
          {count !== undefined && (
            <span className="ml-1 text-xs text-muted-foreground">{count}</span>
          )}
        </Button>
      )}
      {open && (
        <VirtualItemList items={items} scrollElementRef={scrollElementRef} />
      )}
    </div>
  );
};
