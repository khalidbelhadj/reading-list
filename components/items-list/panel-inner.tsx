// PanelInner: the item panel's content layer — toolbar (close/expand, badges,
// item dropdown), find bar, DetailPanel scroll body, title-morph overlay, and
// the delete confirmation flow. Shared by the sliding panel and ItemWindow.
import {
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconDots,
  IconFileFilled,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Image from "@/components/ui/image";
import { LoadingFade } from "@/components/ui/loading-fade";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchItems } from "@/lib/queries";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DeleteItemsDialog } from "./delete-item-dialog";
import { DetailPanel } from "./detail-panel";
import { DetailPanelSkeleton } from "./detail-panel-skeleton";
import { FindBar } from "./find-bar";
import { ItemDropdown } from "./item-dropdown";
import { useItemMutations } from "./use-item-mutations";
import { usePanelFind } from "./use-panel-find";
import { useTitleMorph } from "./use-title-morph";
import { type EditFields, getFaviconSrc } from "./utils";

// Chrome flavor for PanelInner. "side"/"fullw" mirror the sliding panel's
// open phases; "window" is a dedicated single-item window (ItemWindow) that
// fills its window edge-to-edge and drops the close/expand affordances.
export type PanelChrome = "side" | "fullw" | "window";

// The floating title row that useTitleMorph interpolates between the content
// title and the toolbar's header slot. Positioned/faded entirely via direct
// style writes from the hook; starts invisible.
const TitleMorphOverlay = ({
  morphRef,
  faviconSrc,
  title,
}: {
  morphRef: React.RefObject<HTMLDivElement | null>;
  faviconSrc: string | null;
  title: string;
}) => (
  <div
    ref={morphRef}
    className="pointer-events-none absolute top-0 left-0 z-20 flex items-center"
    style={{ opacity: 0 }}
  >
    <div
      data-morph-icon
      className="flex shrink-0 items-center justify-center"
      style={{ width: 24, height: 24 }}
    >
      {faviconSrc ? (
        <Image
          src={faviconSrc}
          alt=""
          width={24}
          height={24}
          className="h-full w-full rounded object-contain"
          unoptimized
        />
      ) : (
        <IconFileFilled className="h-full w-full text-muted-foreground" />
      )}
    </div>
    <span className="truncate font-content font-semibold">
      {title || "Untitled"}
    </span>
  </div>
);

export const PanelInner = ({
  itemId,
  onClose,
  // "side"/"fullw" are the sliding side panel's open phases; "window" is a
  // dedicated single-item window (ItemWindow) that drops the close/collapse
  // affordances — the window *is* the item, so there's nothing to close or
  // restore to.
  chrome,
  onExpand,
  onRestore,
  // The sliding panel disables Cmd+F find while it's closed / sliding off;
  // a dedicated window is always active.
  findEnabled = true,
}: {
  itemId: string;
  onClose: () => void;
  chrome: PanelChrome;
  onExpand?: () => void;
  onRestore?: () => void;
  findEnabled?: boolean;
}) => {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });
  const liveItem = items?.find((i) => i.id === itemId) ?? null;

  // Hold onto the last-seen item so the panel keeps rendering its content
  // during the close animation after an optimistic delete removes the item
  // from the cache. Reset when the panel switches to a different itemId.
  const [snapshot, setSnapshot] = React.useState<Item | null>(liveItem);
  React.useEffect(() => {
    setSnapshot(null);
  }, [itemId]);
  React.useEffect(() => {
    if (liveItem) setSnapshot(liveItem);
  }, [liveItem]);
  const item = liveItem ?? snapshot;

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const morphRef = React.useRef<HTMLDivElement | null>(null);
  const headerSlotRef = React.useRef<HTMLDivElement | null>(null);

  const faviconSrc = item
    ? getFaviconSrc({ faviconUrl: item.faviconUrl, url: item.url })
    : null;

  const scrolled = useTitleMorph({ scrollRef, morphRef, headerSlotRef, item });

  const {
    setItemReadMutation,
    togglePinMutation,
    toggleHiddenFromReviewMutation,
    deleteMutation,
    updateMutation,
  } = useItemMutations();

  const handleSave = React.useCallback(
    (id: string, fields: EditFields) => {
      const tagNames = fields.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      updateMutation.mutate({
        itemId: id,
        fields: {
          title: fields.title,
          url: fields.url,
          notes: fields.notes,
          tagNames,
        },
      });
    },
    [updateMutation],
  );

  const handleTogglePin = React.useCallback(() => {
    if (!item) return;
    togglePinMutation.mutate({ itemId: item.id, starred: !item.starred });
  }, [item, togglePinMutation]);

  const handleToggleRead = React.useCallback(() => {
    if (!item) return;
    setItemReadMutation.mutate({ itemId: item.id, read: !item.read });
  }, [item, setItemReadMutation]);

  const handleToggleHiddenFromReview = React.useCallback(() => {
    if (!item) return;
    toggleHiddenFromReviewMutation.mutate({
      itemId: item.id,
      hiddenFromReview: !item.hiddenFromReview,
    });
  }, [item, toggleHiddenFromReviewMutation]);

  const handleDelete = React.useCallback(() => {
    if (!item) return;
    setDeleteOpen(false);
    if (chrome === "window") {
      // A dedicated item window closes itself on delete (onClose === window.close).
      // Closing *before* the mutation settles tears the window down mid-flight:
      // the server delete may be aborted and, worse, its invalidation broadcast
      // to sibling windows never fires (see LocalSyncWatcher's coalescing timer),
      // so the main window keeps showing the deleted item. Keep the window alive
      // until the delete has persisted and its invalidations are queued, then
      // close — pagehide flushes the pending broadcast on the way out.
      deleteMutation.mutate(item.id, { onSettled: () => onClose() });
      return;
    }
    onClose();
    deleteMutation.mutate(item.id);
  }, [item, deleteMutation, onClose, chrome]);

  const isExpanded = chrome === "fullw";

  const find = usePanelFind({ scrollRef, enabled: findEnabled });

  return (
    <>
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center gap-0.5 bg-inherit p-1 transition-[padding] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)]",
          // A dedicated window has no outer margins, so put the same inset
          // back as internal padding — the buttons sit at the same absolute
          // position as in the padded panel chromes.
          chrome === "window" && "pt-3 pr-3 pl-3",
          // The panel toolbar is always a window drag region in Electron
          // (you can grab anywhere along the top bar to move the window).
          "electron-top-bar-inset",
          // Reserve macOS traffic-light space once the panel starts covering
          // the top-left of the window. `panel-toolbar` forces the 80px
          // clearance regardless of viewport width (see globals.css). In
          // side mode the panel is on the right edge and doesn't need it.
          chrome !== "side" && "panel-toolbar",
        )}
      >
        {chrome !== "window" && (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    onClick={onClose}
                  />
                }
              >
                <IconX />
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    onClick={isExpanded ? onRestore : onExpand}
                  />
                }
              >
                {isExpanded ? (
                  <IconArrowsDiagonalMinimize2 />
                ) : (
                  <IconArrowsDiagonal />
                )}
              </TooltipTrigger>
              <TooltipContent>
                {isExpanded ? "Restore" : "Expand"}
              </TooltipContent>
            </Tooltip>
          </>
        )}
        <div ref={headerSlotRef} className="ml-1 h-5 flex-1" />
        {item?.hiddenFromReview && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge variant="secondary" className="mr-0.5">
                  Hidden from review
                </Badge>
              }
            />
            <TooltipContent>
              This item&apos;s flashcards are excluded from your review queue
            </TooltipContent>
          </Tooltip>
        )}
        {item?.read && (
          <Badge variant="secondary" className="mr-0.5">
            Read
          </Badge>
        )}
        {item ? (
          <ItemDropdown
            item={item}
            onTogglePin={handleTogglePin}
            onToggleRead={handleToggleRead}
            onToggleHiddenFromReview={handleToggleHiddenFromReview}
            onDelete={() => setDeleteOpen(true)}
          >
            <Tooltip>
              <DropdownMenuTrigger
                render={
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                      />
                    }
                  >
                    <IconDots />
                  </TooltipTrigger>
                }
              />
              <TooltipContent>More options</TooltipContent>
            </Tooltip>
          </ItemDropdown>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            disabled
          >
            <IconDots />
          </Button>
        )}
        <div
          className={cn(
            "pointer-events-none absolute right-0 bottom-0 left-0 h-8 translate-y-full bg-linear-to-b from-surface to-transparent transition-opacity duration-200",
            scrolled ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      <FindBar find={find} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          className={cn(
            "mx-auto flex min-h-full w-full max-w-175 flex-col px-3 pt-1 pb-12",
            chrome === "window" && "px-4 pt-2",
          )}
        >
          <LoadingFade
            loading={!item}
            skeleton={<DetailPanelSkeleton />}
            className="flex flex-1 flex-col"
          >
            {item ? (
              <DetailPanel
                key={item.id}
                item={item}
                onSave={handleSave}
                onDelete={() => setDeleteOpen(true)}
              />
            ) : null}
          </LoadingFade>
        </div>
      </div>

      {item && (
        <TitleMorphOverlay
          morphRef={morphRef}
          faviconSrc={faviconSrc}
          title={item.title}
        />
      )}

      <DeleteItemsDialog
        item={item}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
      />
    </>
  );
};
