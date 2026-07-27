import { type Item } from "@/lib/types";

import { Favicon } from "./favicon";
import { RowMenu, RowTitle } from "./row-content-shared";

export const ItemRowContent = ({
  item,
  flashcardCount: _flashcardCount,
  isOpen,
  isTyping,
  menuOpen,
  suppressHover,
  onMenuOpenChange,
  onTogglePin,
  onToggleRead,
  onToggleHiddenFromReview,
  onDelete,
}: {
  item: Item;
  flashcardCount: number;
  // Whether this row's item is open in the detail panel — drives the solid
  // bg-muted occluder that matches the open row's background.
  isOpen: boolean;
  isTyping?: boolean;
  menuOpen: boolean;
  suppressHover?: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onTogglePin?: () => void;
  onToggleRead?: () => void;
  onToggleHiddenFromReview?: () => void;
  onDelete?: () => void;
}) => (
  <>
    <div className="relative size-4 shrink-0">
      <Favicon item={item} className="size-4" />
    </div>
    <RowTitle item={item} isTyping={isTyping} className="flex-1" />
    <RowMenu
      item={item}
      isOpen={isOpen}
      menuOpen={menuOpen}
      suppressHover={suppressHover}
      align="center"
      onMenuOpenChange={onMenuOpenChange}
      onTogglePin={onTogglePin}
      onToggleRead={onToggleRead}
      onToggleHiddenFromReview={onToggleHiddenFromReview}
      onDelete={onDelete}
    />
  </>
);
