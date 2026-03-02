import { Button } from "@/components/ui/button";
import {
  IconArrowsExchange,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconSearch,
  IconTag,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import React from "react";

import { cn } from "@/lib/utils";
import { type DbTag } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";

export function Toolbar({
  activeTab,
  setActiveTabAndUrl,
  isFetching,
  pendingActions,
  bulkMode,
  selectedIds,
  tabType,
  searchOpen,
  setSearchOpen,
  search,
  setSearch,
  searchInputRef,
  allTags,
  tagsOpen,
  setTagsOpen,
  activeTags,
  showRead,
  setShowRead,
  setEditingId,
  setBulkMode,
  setSelectedIds,
  setTagDialogInput,
  setTagDialogOpen,
  handleBulkMarkRead,
  handleBulkMove,
  handleBulkDelete,
}: {
  activeTab: string;
  setActiveTabAndUrl: (tab: string) => void;
  isFetching: boolean;
  pendingActions: number;
  bulkMode: boolean;
  selectedIds: Set<string>;
  tabType: string;
  searchOpen: boolean;
  setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  allTags: DbTag[];
  tagsOpen: boolean;
  setTagsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeTags: Set<string>;
  showRead: boolean;
  setShowRead: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  setBulkMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setTagDialogInput: React.Dispatch<React.SetStateAction<string>>;
  setTagDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleBulkMarkRead: (read: boolean) => Promise<void>;
  handleBulkMove: () => Promise<void>;
  handleBulkDelete: () => Promise<void>;
}) {
  return (
    <div className="flex items-center relative">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTabAndUrl}
        variant="text"
        tabs={[
          { label: "Reading List", value: "reading-list" },
          { label: "Bookmarks", value: "bookmarks" },
        ]}
      />
      {(isFetching || pendingActions > 0) && <Spinner className="size-3 text-muted-foreground/50 ml-2" />}
      <div className="flex-1" />

      {bulkMode && selectedIds.size >= 1 ? (
        <>
          <span className="absolute left-1/2 -translate-x-1/2 text-xs text-muted-foreground">{selectedIds.size} selected</span>
          {tabType === "reading-list" && (
            <>
              <Button variant="ghost" size="icon" className="text-muted-foreground" title="Mark read" onClick={() => void handleBulkMarkRead(true)}>
                <IconEye />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground" title="Mark unread" onClick={() => void handleBulkMarkRead(false)}>
                <IconEyeOff />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="text-muted-foreground" title={`Move to ${tabType === "reading-list" ? "Bookmarks" : "Reading List"}`} onClick={() => void handleBulkMove()}>
            <IconArrowsExchange />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground" title="Tag" onClick={() => { setTagDialogInput(""); setTagDialogOpen(true); }}>
            <IconTag />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground" title="Delete" onClick={() => void handleBulkDelete()}>
            <IconTrash />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground" title="Clear selection" onClick={() => { setSelectedIds(new Set()); setBulkMode(false); }}>
            <IconX />
          </Button>
        </>
      ) : (
        <>
          {/* Search toggle */}
          <div
            className={cn(
              "flex items-center h-7 overflow-hidden rounded-md border transition-all duration-200 ease-out",
              searchOpen
                ? "w-52 border-input bg-input/20"
                : "w-7 border-transparent",
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              onClick={() => {
                setSearchOpen(true);
                requestAnimationFrame(() => searchInputRef.current?.focus());
              }}
            >
              <IconSearch />
            </Button>
            <input
              ref={searchInputRef}
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearch("");
                  setSearchOpen(false);
                  searchInputRef.current?.blur();
                }
                if (e.key === "Enter") {
                  searchInputRef.current?.blur();
                }
              }}
              className="flex-1 min-w-0 h-7 bg-transparent text-xs outline-none"
              tabIndex={searchOpen ? 0 : -1}
            />
          </div>

          {/* Tags toggle */}
          {allTags.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              aria-expanded={tagsOpen || activeTags.size > 0}
              className={
                tagsOpen || activeTags.size > 0
                  ? "text-foreground"
                  : "text-muted-foreground"
              }
              onClick={() => setTagsOpen((v) => !v)}
            >
              <IconTag />
            </Button>
          )}

          {/* Show read toggle */}
          {tabType === "reading-list" && (
            <Button
              variant="ghost"
              size="icon"
              aria-expanded={showRead}
              className={
                showRead ? "text-foreground" : "text-muted-foreground"
              }
              onClick={() => setShowRead((v) => !v)}
              title={showRead ? "Hide read items" : "Show read items"}
            >
              {showRead ? <IconEye /> : <IconEyeOff />}
            </Button>
          )}

          {/* Add */}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => setEditingId("new")}
          >
            <IconPlus />
          </Button>
        </>
      )}
    </div>
  );
}
