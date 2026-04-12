import { Button } from "@/components/ui/button";
import {
  IconEye,
  IconEyeOff,
  IconPlus,
  IconSearch,
  IconTag,
  IconX,
} from "@tabler/icons-react";
import React from "react";

import { cn } from "@/lib/utils";
import { type DbTag } from "@/lib/types";
import { Tabs } from "@/components/ui/tabs";

export const Toolbar = ({
  activeTab,
  setActiveTabAndUrl,
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
  isMobile,
}: {
  activeTab: string;
  setActiveTabAndUrl: (tab: string) => void;
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
  isMobile: boolean;
}) => {
  return (
    <>
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
        <div className="flex-1" />

        {/* Search toggle */}
        {!isMobile && (
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
                if (searchOpen) {
                  setSearch("");
                  setSearchOpen(false);
                } else {
                  setSearchOpen(true);
                  requestAnimationFrame(() =>
                    searchInputRef.current?.focus(),
                  );
                }
              }}
            >
              <IconSearch />
            </Button>
            <input
              ref={isMobile ? undefined : searchInputRef}
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
        )}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className={
              searchOpen ? "text-foreground" : "text-muted-foreground"
            }
            onClick={() => {
              setSearchOpen((v) => {
                if (v) setSearch("");
                return !v;
              });
            }}
          >
            <IconSearch />
          </Button>
        )}

        {/* Tags toggle */}
        <Button
          variant="ghost"
          size="icon"
          aria-expanded={tagsOpen || activeTags.size > 0}
          className={
            tagsOpen || activeTags.size > 0
              ? "text-foreground"
              : "text-muted-foreground"
          }
          disabled={allTags.length === 0}
          onClick={() => setTagsOpen((v) => !v)}
        >
          <IconTag />
        </Button>

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
      </div>

      {/* Mobile search row */}
      {isMobile && searchOpen && (
        <div className="flex items-center gap-2 h-8 rounded-md border border-input bg-input/20 px-2">
          <IconSearch className="size-3.5 text-muted-foreground shrink-0" />
          <input
            ref={searchInputRef}
            autoFocus
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 h-8 bg-transparent text-sm outline-none"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground shrink-0"
            onClick={() => {
              setSearch("");
              setSearchOpen(false);
            }}
          >
            <IconX />
          </Button>
        </div>
      )}
    </>
  );
}
