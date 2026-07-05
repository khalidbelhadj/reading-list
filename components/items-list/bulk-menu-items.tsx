import {
  IconCopy,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconPin,
  IconPinnedOff,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchItems } from "@/lib/queries";
import { type Item } from "@/lib/types";
import { useIsElectron } from "@/lib/use-is-electron";

import { useItemActions } from "./item-row-context";

// Bulk-action menu shown when right-clicking a row that's part of a
// multi-selection (see ItemRow). `itemIds` is a snapshot of the selection at
// menu-open time, so the menu and its actions always agree on the targets.
// Mutating actions go through the bulk handlers on the items-list (which own
// optimistic updates, cursor fixup, and the delete confirm dialog); copy and
// open-URLs are pure client-side and live here.
export const BulkMenuItems = ({ itemIds }: { itemIds: string[] }) => {
  const { bulk } = useItemActions();
  const isElectron = useIsElectron();

  const { data: allItems } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  const selectedItems = React.useMemo(() => {
    const ids = new Set(itemIds);
    return (allItems ?? []).filter((item) => ids.has(item.id));
  }, [allItems, itemIds]);

  const urlItems = React.useMemo(
    () => selectedItems.filter((item) => !!item.url && URL.canParse(item.url)),
    [selectedItems],
  );

  // The web can only open one URL programmatically — the browser blocks all
  // but the first popup — so hide the batch "Open URLs" there unless it's a
  // single URL. Electron routes each to the system browser, so any count works.
  const canOpenUrls =
    urlItems.length > 0 && (isElectron || urlItems.length === 1);

  const anyUnread = selectedItems.some((item) => !item.read);
  const allPinned =
    selectedItems.length > 0 && selectedItems.every((item) => item.starred);

  const handleOpenUrls = React.useCallback(() => {
    // Browsers may block all but the first popup; Electron routes each to the
    // system browser, so the whole batch opens there.
    for (const item of urlItems) {
      window.open(item.url ?? "", "_blank", "noopener,noreferrer");
    }
  }, [urlItems]);

  const handleCopy = React.useCallback(
    (kind: "ids" | "urls" | "titles") => {
      const lines =
        kind === "ids"
          ? itemIds
          : kind === "urls"
            ? urlItems.map((item) => item.url ?? "")
            : selectedItems.map((item) => item.title || "Untitled");
      navigator.clipboard.writeText(lines.join("\n"));
    },
    [itemIds, selectedItems, urlItems],
  );

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {itemIds.length} selected
        </DropdownMenuLabel>
      </DropdownMenuGroup>
      {canOpenUrls && (
        <DropdownMenuItem onClick={handleOpenUrls}>
          <IconExternalLink />
          Open URLs
          <span className="ml-auto pl-3 text-muted-foreground tabular-nums">
            {urlItems.length}
          </span>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={() => bulk.markRead(itemIds, anyUnread)}>
        {anyUnread ? <IconEye /> : <IconEyeOff />}
        {anyUnread ? "Mark as read" : "Mark as unread"}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => bulk.setPinned(itemIds, !allPinned)}>
        {allPinned ? <IconPinnedOff /> : <IconPin />}
        {allPinned ? "Unpin" : "Pin"}
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <IconCopy />
          Copy
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem onClick={() => handleCopy("ids")}>
            Copy IDs
          </DropdownMenuItem>
          {urlItems.length > 0 && (
            <DropdownMenuItem onClick={() => handleCopy("urls")}>
              Copy URLs
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => handleCopy("titles")}>
            Copy titles
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem
        variant="destructive"
        onClick={() => bulk.requestDelete(itemIds)}
      >
        <IconTrash />
        Delete
        <span className="ml-auto pl-3 tabular-nums">{itemIds.length}</span>
      </DropdownMenuItem>
    </>
  );
};
