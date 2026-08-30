import {
  IconCards,
  IconChevronLeft,
  IconChevronRight,
  IconCirclePlus,
  IconClipboard,
  IconLayoutSidebar,
  IconList,
  IconStarFilled,
  IconWorld,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { fetchItems } from "@/app/actions";
import { ItemPreview } from "@/components/app/item-preview";
import { SidebarItem } from "@/components/app/sidebar-item";
import { useDueCount } from "@/components/shell/review-queues";
import { Button } from "@/components/system/button";
import { HoverCard, useHoverAnchor } from "@/components/system/hover-card";
import { TextLink } from "@/components/system/link";
import { Sidebar } from "@/components/system/sidebar";
import { Skeleton } from "@/components/system/skeleton";
import { Tooltip } from "@/components/system/tooltip";
import { useOpenTabItems } from "@/lib/open-tabs";
import { isElectron } from "@/lib/platform";
import { type Item } from "@/lib/types";

import { ItemRow } from "./item-row";
import { SettingsMenu } from "./settings-menu";
import { clipboardUrl } from "./use-create-item";
import { useItemPreview } from "./use-item-preview";
import { isActiveView, type View } from "./view";

const RECENT_LIMIT = 20;

// Traffic-light clearance and a window drag handle in Electron; the sidebar
// toggle sits just after the traffic lights, history arrows in the far
// corner.
const SidebarTopBar = ({
  onToggle,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: {
  onToggle: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}) => (
  <div className="electron-top-bar-inset panel-toolbar flex h-12 shrink-0 items-center justify-between px-2">
    <Tooltip content="Hide sidebar">
      <Button
        data-no-drag
        variant="ghost"
        size="icon-md"
        aria-label="Hide sidebar"
        onClick={onToggle}
      >
        <IconLayoutSidebar />
      </Button>
    </Tooltip>
    <div className="flex items-center">
      <Tooltip content="Back">
        <Button
          data-no-drag
          variant="ghost"
          size="icon-md"
          aria-label="Back"
          disabled={!canGoBack}
          onClick={onBack}
        >
          <IconChevronLeft />
        </Button>
      </Tooltip>
      <Tooltip content="Forward">
        <Button
          data-no-drag
          variant="ghost"
          size="icon-md"
          aria-label="Forward"
          disabled={!canGoForward}
          onClick={onForward}
        >
          <IconChevronRight />
        </Button>
      </Tooltip>
    </div>
  </div>
);

// A labelled group of item rows (Open in browser, Starred): the shared shape
// of the sidebar's pinned sections above Recent.
const SidebarItemGroup = ({
  label,
  icon,
  items,
  view,
  showStar = true,
  onViewChange,
  onMenuOpenChange,
  onHoverItem,
  onHoverLeave,
}: {
  label: string;
  icon?: React.ReactNode;
  items: Item[];
  view: View;
  showStar?: boolean;
  onViewChange: (view: View) => void;
  onMenuOpenChange: (open: boolean) => void;
  onHoverItem: (id: string, anchor: HTMLElement) => void;
  onHoverLeave: () => void;
}) => (
  <div className="mt-5 flex shrink-0 flex-col gap-1 px-2">
    <p className="flex items-center gap-1.5 px-2 text-micro font-medium text-muted-foreground">
      {icon}
      {label}
    </p>
    <ul className="flex flex-col gap-0.5" onPointerLeave={onHoverLeave}>
      {items.map((item) => (
        <li key={item.id}>
          <ItemRow
            item={item}
            showStar={showStar}
            onMenuOpenChange={onMenuOpenChange}
            className="h-sidebar-row"
            selected={isActiveView(view, "item", item.id)}
            onOpen={(id) => onViewChange({ kind: "item", id })}
            onPointerEnter={(event) =>
              onHoverItem(item.id, event.currentTarget as HTMLElement)
            }
          />
        </li>
      ))}
    </ul>
  </div>
);

// The app's sidebar: one action (New item), two places (All items, Review),
// then the twenty most recent items (favicon and title). One thing is
// active at a time (All items, Review, or an item); the shell owns that
// state and this only renders and requests changes to it.
export const AppSidebar = ({
  view,
  onViewChange,
  onNewItem,
  onPasteUrl,
  open,
  onToggle,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: {
  view: View;
  onViewChange: (view: View) => void;
  onNewItem: () => void;
  onPasteUrl: () => void;
  open: boolean;
  onToggle: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}) => {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });
  const dueCount = useDueCount();
  // The sidebar is the working set: read items drop out of both groups (they
  // stay in the Reading list). Starred items have their own group above, so
  // Recent excludes them too.
  const recent = React.useMemo(
    () =>
      (items ?? [])
        .filter((item) => !item.starred && !item.read)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, RECENT_LIMIT),
    [items],
  );
  const starred = React.useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.starred && !item.read)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [items],
  );
  // Items open in a browser tab right now (desktop only; empty elsewhere).
  const openInBrowser = useOpenTabItems(items);

  // One hover card for the whole sidebar, gliding between rows of any group.
  // It stands down while any row's context menu is open.
  const hover = useHoverAnchor();
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [openMenus, setOpenMenus] = React.useState(0);
  const handleMenuOpenChange = React.useCallback(
    (open: boolean) =>
      setOpenMenus((count) => Math.max(0, count + (open ? 1 : -1))),
    [],
  );
  const hovered = (items ?? []).find((item) => item.id === hoveredId) ?? null;
  // The hover card shows the item's preview thumbnail; resolve (and lazily
  // generate) it only while something is actually hovered.
  const hoverPreviewUrl = useItemPreview(
    hovered ?? { id: "", url: "" },
    hovered !== null,
  );
  const { enter: hoverEnter } = hover;
  const handleHoverItem = React.useCallback(
    (id: string, anchor: HTMLElement) => {
      setHoveredId(id);
      hoverEnter(anchor);
    },
    [hoverEnter],
  );
  const nowIso = React.useMemo(() => new Date().toISOString(), []);

  const showItems = React.useCallback(
    () => onViewChange({ kind: "items" }),
    [onViewChange],
  );
  const showReview = React.useCallback(
    () => onViewChange({ kind: "review" }),
    [onViewChange],
  );

  // The paste affordance on New item: revealed on hover, and in Electron only
  // when the clipboard actually holds a link (the sniff is silent there; on
  // web reading the clipboard can prompt, so the icon shows on hover and the
  // click validates instead).
  const [pasteReady, setPasteReady] = React.useState(false);
  const sniffClipboard = React.useCallback(() => {
    if (!isElectron()) {
      setPasteReady(true);
      return;
    }
    navigator.clipboard
      .readText()
      .then((text) => setPasteReady(clipboardUrl(text) !== null))
      .catch(() => setPasteReady(false));
  }, []);
  const handlePasteClick = React.useCallback(
    (event: React.MouseEvent) => {
      // The affordance sits inside the row; don't also create a blank item.
      event.stopPropagation();
      onPasteUrl();
    },
    [onPasteUrl],
  );

  return (
    <Sidebar storageKey="app-sidebar-width" open={open}>
      <SidebarTopBar
        onToggle={onToggle}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={onBack}
        onForward={onForward}
      />
      <nav className="flex flex-col gap-0.5 px-2">
        <SidebarItem
          role="button"
          tabIndex={0}
          icon={<IconCirclePlus />}
          label="New item"
          className="group/new"
          onClick={onNewItem}
          onPointerEnter={sniffClipboard}
          trailing={
            pasteReady && (
              <Tooltip content="Add from clipboard">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Add from clipboard"
                  className="-mr-1 hidden size-5 group-hover/new:inline-flex"
                  onClick={handlePasteClick}
                >
                  <IconClipboard />
                </Button>
              </Tooltip>
            )
          }
        />
        <SidebarItem
          role="button"
          tabIndex={0}
          icon={<IconList />}
          label="Reading list"
          active={isActiveView(view, "items")}
          onClick={showItems}
        />
        <SidebarItem
          role="button"
          tabIndex={0}
          icon={<IconCards />}
          label="Review"
          active={isActiveView(view, "review")}
          onClick={showReview}
          count={dueCount > 0 ? dueCount : undefined}
        />
      </nav>

      <div
        className="fade-y min-h-0 flex-1 overflow-y-auto pb-4"
        onPointerLeave={hover.leave}
      >
        {items && openInBrowser.length > 0 && (
          <SidebarItemGroup
            label="Open in browser"
            icon={<IconWorld className="size-2.5" />}
            items={openInBrowser}
            view={view}
            onViewChange={onViewChange}
            onMenuOpenChange={handleMenuOpenChange}
            onHoverItem={handleHoverItem}
            onHoverLeave={hover.leave}
          />
        )}

        {items && starred.length > 0 && (
          <SidebarItemGroup
            label="Starred"
            icon={<IconStarFilled className="size-2.5 text-starred" />}
            items={starred}
            view={view}
            showStar={false}
            onViewChange={onViewChange}
            onMenuOpenChange={handleMenuOpenChange}
            onHoverItem={handleHoverItem}
            onHoverLeave={hover.leave}
          />
        )}

        <div className="mt-5 flex flex-col gap-1 px-2">
          <p className="px-2 text-micro font-medium text-muted-foreground">
            Recent
          </p>
          {items ? (
            <ul className="flex flex-col gap-0.5" onPointerLeave={hover.leave}>
              {recent.map((item) => (
                <li key={item.id}>
                  <ItemRow
                    item={item}
                    onMenuOpenChange={handleMenuOpenChange}
                    className="h-sidebar-row"
                    selected={isActiveView(view, "item", item.id)}
                    onOpen={(id) => onViewChange({ kind: "item", id })}
                    onPointerEnter={(event) => {
                      setHoveredId(item.id);
                      hover.enter(event.currentTarget as HTMLElement);
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col gap-0.5">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-sidebar-row w-full" />
              ))}
            </div>
          )}
          {items && (
            <div className="flex h-sidebar-row shrink-0 items-center px-2">
              <TextLink
                variant="quiet"
                href="#"
                className="flex items-center gap-0.5 text-micro font-medium"
                onClick={(event) => {
                  event.preventDefault();
                  showItems();
                }}
              >
                See all items
                <IconChevronRight className="size-3" />
              </TextLink>
            </div>
          )}
        </div>
      </div>

      <HoverCard
        anchor={hover.anchor}
        open={hover.open && hovered !== null && openMenus === 0}
        width={400}
      >
        {hovered && (
          <ItemPreview
            item={hovered}
            previewImageUrl={hoverPreviewUrl}
            nowIso={nowIso}
          />
        )}
      </HoverCard>

      {/* The gear, pinned in the bottom-right corner. */}
      <div className="flex shrink-0 items-center justify-end px-2 pt-1 pb-2">
        <SettingsMenu />
      </div>
    </Sidebar>
  );
};
