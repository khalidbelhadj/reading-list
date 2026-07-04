import { type Item } from "@/lib/types";

import { ItemRow } from "./item-row";

type ItemListProps = {
  items: Item[];
  // The same item can appear in more than one section (pinned + its date/tag
  // group), so callers pass a prefix to keep React keys unique across lists.
  keyPrefix?: string;
};

/**
 * Renders a tightly-spaced column of item rows. Shared by every list surface —
 * each date/tag group, the pinned section, and the flat (group-by-none /
 * search) list — so spacing stays identical everywhere. The `space-y-px` here
 * is the single source of truth for inter-row spacing.
 *
 * Row actions, hover suppression, typing titles, and density all reach the rows
 * via context/settings ({@link ItemRow}), so this stays a pure layout wrapper.
 */
export const ItemList = ({ items, keyPrefix }: ItemListProps) => (
  <div className="space-y-px">
    {items.map((item) => (
      <ItemRow
        key={keyPrefix ? `${keyPrefix}:${item.id}` : item.id}
        item={item}
      />
    ))}
  </div>
);
