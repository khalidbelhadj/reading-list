import { type Item } from "@/lib/types";

import { ItemRow } from "./item-row";
import { resolveRowItem, type Density } from "./utils";

type ItemListProps = {
  items: Item[];
  typingTitles: Record<string, string>;
  suppressHover: boolean;
  density?: Density;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleRead: (id: string, read: boolean) => void;
  onTogglePin: (id: string, starred: boolean) => void;
  // The same item can appear in more than one section (pinned + its date/tag
  // group), so callers pass a prefix to keep React keys unique across lists.
  keyPrefix?: string;
};

/**
 * Renders a tightly-spaced column of item rows. Shared by every list surface —
 * each date/tag group, the pinned section, and the flat (group-by-none /
 * search) list — so spacing stays identical everywhere. The `space-y-px` here
 * is the single source of truth for inter-row spacing.
 */
export const ItemList = ({
  items,
  typingTitles,
  suppressHover,
  density = "compact",
  onSelect,
  onDelete,
  onToggleRead,
  onTogglePin,
  keyPrefix,
}: ItemListProps) => (
  <div className="space-y-px">
    {items.map((item) => {
      const typingTitle = typingTitles[item.id];
      const rowItem = resolveRowItem(item, typingTitle);
      return (
        <ItemRow
          key={keyPrefix ? `${keyPrefix}:${item.id}` : item.id}
          item={rowItem}
          suppressHover={suppressHover}
          density={density}
          isTyping={typingTitle !== undefined}
          onSelect={() => onSelect(item.id)}
          onDelete={() => onDelete(item.id)}
          onToggleRead={() => onToggleRead(item.id, !item.read)}
          onTogglePin={() => onTogglePin(item.id, !item.starred)}
        />
      );
    })}
  </div>
);
