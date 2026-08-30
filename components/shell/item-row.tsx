import { IconStarFilled } from "@tabler/icons-react";
import type React from "react";

import { Favicon } from "@/components/app/favicon";
import { ItemMenu } from "@/components/app/item-menu";
import { ItemThumbnail } from "@/components/app/item-thumbnail";
import { ListRow } from "@/components/app/list-row";
import { PreviewRow } from "@/components/app/preview-row";
import { openChatWithClaude } from "@/lib/chat-with-claude";
import { focusBrowserTab, useOpenTab } from "@/lib/open-tabs";
import { type Item } from "@/lib/types";

import { useItemActions } from "./use-item-actions";
import { useItemPreview } from "./use-item-preview";
import { dispatchViewCommand } from "./view";

// The one item row for every list in the shell (sidebar Recent, All items,
// search and Ask results, the palette): favicon, title, a gold star when
// starred, and the shared right-click menu wired to the optimistic actions.
// `variant="preview"` wears the roomier two-line PreviewRow (pass `meta` for
// its second line); default is the compact one-liner.
export const ItemRow = ({
  item,
  onOpen,
  selected,
  className,
  onPointerEnter,
  variant = "compact",
  meta,
  // The sidebar's Starred group marks itself in its heading, so its rows
  // skip the per-row star.
  showStar = true,
  onMenuOpenChange,
}: {
  item: Item;
  onOpen: (id: string) => void;
  selected?: boolean;
  className?: string;
  onPointerEnter?: React.PointerEventHandler;
  variant?: "compact" | "preview";
  meta?: React.ReactNode;
  showStar?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
}) => {
  const actions = useItemActions();
  const previewImageUrl = useItemPreview(item, variant === "preview");
  const openTab = useOpenTab(item.url || null);
  const Row = variant === "preview" ? PreviewRow : ListRow;
  const leading =
    variant === "preview" ? (
      <ItemThumbnail
        item={item}
        previewImageUrl={previewImageUrl}
        className="aspect-video w-24 rounded-[3px]"
      />
    ) : (
      <Favicon item={item} />
    );

  return (
    <ItemMenu
      item={item}
      onOpenChange={onMenuOpenChange}
      onToggleRead={() => actions.toggleRead(item)}
      onToggleStar={() => actions.toggleStar(item)}
      onToggleHidden={() => actions.toggleHiddenFromReview(item)}
      onDelete={() => actions.removeItem(item)}
      onOpenLink={() => actions.openLink(item)}
      onCopyLink={() => actions.copyLink(item)}
      openInBrowser={openTab?.browser ?? null}
      onGoToTab={openTab ? () => focusBrowserTab(openTab.ref) : undefined}
      onChatWithClaude={() => openChatWithClaude(item)}
      onEditLink={() =>
        dispatchViewCommand({ kind: "edit-link", itemId: item.id })
      }
      onReviewItem={() =>
        dispatchViewCommand({ kind: "review-item", itemId: item.id })
      }
    >
      <Row
        leading={leading}
        title={item.title || "Untitled"}
        meta={variant === "preview" ? meta : undefined}
        selected={selected}
        muted={item.read}
        className={className}
        onClick={() => onOpen(item.id)}
        onPointerEnter={onPointerEnter}
        trailing={
          showStar && item.starred ? (
            <IconStarFilled className="size-3 shrink-0 text-starred" />
          ) : undefined
        }
      />
    </ItemMenu>
  );
};
