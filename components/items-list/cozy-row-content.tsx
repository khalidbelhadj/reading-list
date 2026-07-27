import { type Item } from "@/lib/types";

import { ItemThumbnail } from "./item-thumbnail";
import { RowMenu, RowTitle } from "./row-content-shared";

export const CozyRowContent = ({
  item,
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
    <ItemThumbnail
      item={item}
      className="aspect-video w-24 shrink-0 rounded-[3px]"
    />

    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
      <RowTitle item={item} isTyping={isTyping} />
      {item.url && (
        <span className="fade-r block min-w-0 text-xs text-muted-foreground/60">
          {item.url}
        </span>
      )}
      {/*
        Tags are intentionally NOT rendered in cozy mode (they are shown in
        compact mode and the detail panel). Considerations:
        - Row height: the thumbnail is a fixed aspect-video (~54px) while the
          content column drives row height. Title + url sits under the
          thumbnail height, so tagless rows settle at one uniform height. A
          tag row pushes the content column past the thumbnail, making tagged
          rows ~10px taller than their neighbours and breaking the list's
          vertical rhythm.
        - Thumbnail stretch: rows use `items-stretch`, so a taller tagged row
          also stretches the thumbnail, distorting its 16:9 aspect ratio.
        Dropping tags here keeps every cozy row the same height and the
        previews undistorted. If tags are wanted back, also reserve constant
        space for them (so heights stay uniform) and switch the row off
        `items-stretch` so the thumbnail keeps its ratio.
      */}
    </div>

    <RowMenu
      item={item}
      isOpen={isOpen}
      menuOpen={menuOpen}
      suppressHover={suppressHover}
      align="start"
      onMenuOpenChange={onMenuOpenChange}
      onTogglePin={onTogglePin}
      onToggleRead={onToggleRead}
      onToggleHiddenFromReview={onToggleHiddenFromReview}
      onDelete={onDelete}
    />
  </>
);
