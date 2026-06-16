import { IconChevronRight, IconPinFilled } from "@tabler/icons-react";

import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CollapsibleSection } from "./collapsible-section";
import { ItemRow } from "./item-row";
import { resolveRowItem, type Density } from "./utils";

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
    <div className="flex flex-col mb-4">
      <button
        type="button"
        onClick={onToggleOpen}
        className="inline-flex items-center gap-1 px-1 pb-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors outline-none select-none"
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
        {items.map((item) => {
          const typingTitle = typingTitles[item.id];
          const rowItem = resolveRowItem(item, typingTitle);
          return (
            <ItemRow
              key={item.id}
              item={rowItem}
              suppressHover={suppressHover}
              density={density}
              isTyping={typingTitle !== undefined}
              onTogglePin={() => onTogglePin(item.id, !item.starred)}
              onToggleRead={() => onToggleRead(item.id, !item.read)}
              onSelect={() => onSelect(item.id)}
              onDelete={() => onDelete(item.id)}
            />
          );
        })}
      </CollapsibleSection>
    </div>
  );
};
