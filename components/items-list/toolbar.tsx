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

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { SettingsMenu } from "./settings-dialog";
import { AppTabs } from "@/components/items-list/app-tabs";

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
  const handleSearchToggle = React.useCallback(() => {
    if (searchOpen) {
      setSearch("");
      setSearchOpen(false);
    } else {
      setSearchOpen(true);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchOpen, setSearch, setSearchOpen, searchInputRef]);

  const handleSearchInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    [setSearch],
  );

  const handleSearchKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setSearch("");
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
      if (e.key === "Enter") {
        searchInputRef.current?.blur();
      }
    },
    [setSearch, setSearchOpen, searchInputRef],
  );

  const handleMobileSearchToggle = React.useCallback(() => {
    setSearchOpen((v) => {
      if (v) setSearch("");
      return !v;
    });
  }, [setSearch, setSearchOpen]);

  const handleTagsToggle = React.useCallback(() => {
    setTagsOpen((v) => !v);
  }, [setTagsOpen]);

  const handleShowReadToggle = React.useCallback(() => {
    setShowRead((v) => !v);
  }, [setShowRead]);

  const handleAddClick = React.useCallback(() => {
    setEditingId("new");
  }, [setEditingId]);

  const handleMobileSearchClear = React.useCallback(() => {
    setSearch("");
    setSearchOpen(false);
  }, [setSearch, setSearchOpen]);

  return (
    <>
      <div className="flex items-center relative">
        <AppTabs
          value={activeTab}
          onValueChange={setActiveTabAndUrl}
          variant="text"
          tabs={[
            { label: "Reading List", value: "reading-list" },
            { label: "Cards", value: "cards" },
          ]}
        />

        {/* Spacer between the tabs and toolbar */}
        <div className="flex-1" />

        {activeTab !== "cards" && (
          <>
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
                  onClick={handleSearchToggle}
                >
                  <IconSearch />
                </Button>
                <input
                  ref={isMobile ? undefined : searchInputRef}
                  placeholder="Search..."
                  value={search}
                  onChange={handleSearchInputChange}
                  onKeyDown={handleSearchKeyDown}
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
                onClick={handleMobileSearchToggle}
              >
                <IconSearch />
              </Button>
            )}

            {/* Tags toggle */}
            <Tooltip>
              <TooltipTrigger
                render={
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
                    onClick={handleTagsToggle}
                    suppressHydrationWarning
                  >
                    <IconTag />
                  </Button>
                }
              />
              {allTags.length === 0 && (
                <TooltipContent>No tags yet</TooltipContent>
              )}
            </Tooltip>

            {/* Show read toggle */}
            {tabType === "reading-list" && (
              <Button
                variant="ghost"
                size="icon"
                aria-expanded={showRead}
                className={
                  showRead ? "text-foreground" : "text-muted-foreground"
                }
                onClick={handleShowReadToggle}
                title={showRead ? "Hide read items" : "Show read items"}
                suppressHydrationWarning
              >
                <span suppressHydrationWarning className="contents">
                  {showRead ? <IconEye /> : <IconEyeOff />}
                </span>
              </Button>
            )}
          </>
        )}

        {/* Settings */}
        <SettingsMenu />

        {/* Add */}
        <Button size="sm" className="ml-1" onClick={handleAddClick}>
          <IconPlus />
          Add
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
            onChange={handleSearchInputChange}
            className="flex-1 min-w-0 h-8 bg-transparent text-sm outline-none"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground shrink-0"
            onClick={handleMobileSearchClear}
          >
            <IconX />
          </Button>
        </div>
      )}
    </>
  );
};
