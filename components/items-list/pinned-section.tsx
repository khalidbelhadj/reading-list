import { IconChevronRight, IconPinFilled } from "@tabler/icons-react";

import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CollapsibleSection } from "./collapsible-section";
import { ItemList } from "./item-list";
import { type Density } from "./utils";

type PinnedSectionProps = {
  items: Item[];
  open: boolean;
  onToggleOpen: () => void;
  typingTitles: Record<string, string>;
  suppressHover: boolean;
  density?: Density;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleRead: (id: string, read: boolean) => void;
  onTogglePin: (id: string, starred: boolean) => void;
};

/**
 * Collapsible "Pinned" group rendered above the main list. Shared by both the
 * grouped and flat list layouts so the two only differ in their body.
 */
export const PinnedSection = ({
  items,
  open,
  onToggleOpen,
  typingTitles,
  suppressHover,
  density = "compact",
  onSelect,
  onDelete,
  onToggleRead,
  onTogglePin,
}: PinnedSectionProps) => {
  if (items.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col">
      <button
        type="button"
        onClick={onToggleOpen}
        className="inline-flex items-center gap-1 px-1 pb-0.5 text-xs text-muted-foreground transition-colors outline-none select-none hover:text-foreground"
      >
        <IconPinFilled className="size-3" />
        Pinned
        <IconChevronRight
          className={cn(
            "size-3 transition-transform duration-150",
            open && "rotate-90",
          )}
        />
      </button>
      <CollapsibleSection open={open}>
        <ItemList
          items={items}
          typingTitles={typingTitles}
          suppressHover={suppressHover}
          density={density}
          onSelect={onSelect}
          onDelete={onDelete}
          onToggleRead={onToggleRead}
          onTogglePin={onTogglePin}
        />
      </CollapsibleSection>
    </div>
  );
};
