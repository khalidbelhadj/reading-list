"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconChevronDown } from "@tabler/icons-react";

import { logout } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type TabId, type GroupBy } from "@/components/items-list/use-filters";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/lib/use-current-user";
import { downloadItemsCsv, defaultCsvFilename } from "@/lib/csv-export";
import { CopyPromptsDialog } from "./copy-prompts-dialog";

type ThemeKey = "system" | "light" | "dark";

const THEME_LABELS: Record<ThemeKey, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const applyTheme = (theme: ThemeKey) => {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
};

const TAB_LABELS: Record<TabId, string> = {
  "reading-list": "Reading List",
  cards: "Cards",
};

const GROUP_BY_LABELS: Record<GroupBy, string> = {
  none: "None",
  tag: "Tag",
  day: "Day",
};

export const SettingsMenu = ({
  activeTab,
  setActiveTabAndUrl,
  showFilters,
  showReadingListFilters,
  hasTags,
  tagsOpen,
  setTagsOpen,
  showRead,
  setShowRead,
  groupBy,
  setGroupBy,
}: {
  activeTab: TabId;
  setActiveTabAndUrl: (tab: TabId) => void;
  showFilters: boolean;
  showReadingListFilters: boolean;
  hasTags: boolean;
  tagsOpen: boolean;
  setTagsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showRead: boolean;
  setShowRead: React.Dispatch<React.SetStateAction<boolean>>;
  groupBy: GroupBy;
  setGroupBy: React.Dispatch<React.SetStateAction<GroupBy>>;
}) => {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const email = user?.email ?? null;
  const fullName =
    (user?.user_metadata?.full_name as string) ??
    (user?.user_metadata?.name as string) ??
    null;
  const initials = fullName
    ? fullName
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;
  const [theme, setTheme] = React.useState<ThemeKey>("system");
  const [mounted, setMounted] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [exportFilename, setExportFilename] =
    React.useState(defaultCsvFilename());
  const [promptsOpen, setPromptsOpen] = React.useState(false);

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => queryClient.clear(),
  });

  const handleThemeChange = React.useCallback((value: string) => {
    const key = value as ThemeKey;
    setTheme(key);
    if (key === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", key);
    }
    applyTheme(key);
  }, []);

  const openExport = React.useCallback(() => {
    setExportFilename(defaultCsvFilename());
    setExportOpen(true);
  }, []);

  const handleExport = React.useCallback(() => {
    const trimmed = exportFilename.trim();
    if (!trimmed) return;
    downloadItemsCsv(queryClient, trimmed);
    setExportOpen(false);
  }, [queryClient, exportFilename]);

  const handleLogout = React.useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  const handleExportFilenameChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const stripped = value.toLowerCase().endsWith(".csv")
        ? value.slice(0, -4)
        : value;
      setExportFilename(stripped);
    },
    [],
  );

  const handleExportKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleExport();
      }
    },
    [handleExport],
  );

  const handleCancelExport = React.useCallback(() => {
    setExportOpen(false);
  }, []);

  const openPrompts = React.useCallback(() => setPromptsOpen(true), []);

  const handleTagsOpenChange = React.useCallback(
    (checked: boolean) => setTagsOpen(checked),
    [setTagsOpen],
  );

  const handleShowReadChange = React.useCallback(
    (checked: boolean) => setShowRead(checked),
    [setShowRead],
  );

  const handleGroupByChange = React.useCallback(
    (value: string) => setGroupBy(value as GroupBy),
    [setGroupBy],
  );


  React.useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme");
    const initialTheme: ThemeKey =
      stored === "dark" || stored === "light" ? stored : "system";
    setTheme(initialTheme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (localStorage.getItem("theme")) return;
      applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);


  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="font-content text-sm font-medium gap-1.5 inline-flex items-center outline-none"
          >
            <span
              aria-hidden="true"
              className="relative inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-primary shadow-depth-button-primary"
            >
              <svg viewBox="0 0 24 24" className="size-3">
                <g transform="translate(3 3) scale(0.75)">
                  <path
                    className="fill-primary-foreground"
                    d="M14 2a5 5 0 0 1 5 5v14a1 1 0 0 1 -1.555 .832l-5.445 -3.63l-5.444 3.63a1 1 0 0 1 -1.55 -.72l-.006 -.112v-14a5 5 0 0 1 5 -5h4z"
                  />
                </g>
              </svg>
            </span>
            {TAB_LABELS[activeTab]}
            <IconChevronDown className="size-3.5 text-muted-foreground/60" />
          </button>
        }
      />
      <DropdownMenuContent align="start" sideOffset={6} className="min-w-48">
        {(Object.keys(TAB_LABELS) as TabId[]).map((key) => (
          <DropdownMenuItem
            key={key}
            onClick={() => setActiveTabAndUrl(key)}
            className={cn(
              activeTab === key && "bg-secondary focus:bg-secondary",
            )}
          >
            {TAB_LABELS[key]}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {showFilters && (
          <>
            {showReadingListFilters && (
              <DropdownMenuCheckboxItem
                checked={showRead}
                onCheckedChange={handleShowReadChange}
                >
                Show read items
              </DropdownMenuCheckboxItem>
            )}
            <DropdownMenuCheckboxItem
              checked={tagsOpen}
              onCheckedChange={handleTagsOpenChange}
              disabled={!hasTags}
            >
              Filter by tags
            </DropdownMenuCheckboxItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Group by</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={groupBy}
                  onValueChange={handleGroupByChange}
                >
                  {(Object.keys(GROUP_BY_LABELS) as GroupBy[]).map((key) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      {GROUP_BY_LABELS[key]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={handleThemeChange}
            >
              {(Object.keys(THEME_LABELS) as ThemeKey[]).map((key) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {THEME_LABELS[key]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={openExport}>Export as CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={openPrompts}>Edit prompts</DropdownMenuItem>
        {mounted && (fullName || email) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className="flex items-center gap-2">
                  {initials && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                      {initials}
                    </span>
                  )}
                  {fullName ?? email}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {email && (
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                      {email}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export as CSV</DialogTitle>
          </DialogHeader>
          <div className="flex h-8 items-center rounded-md bg-card px-2 ring-1 ring-foreground/10 focus-within:ring-foreground/25">
            <input
              autoFocus
              value={exportFilename}
              onChange={handleExportFilenameChange}
              onKeyDown={handleExportKeyDown}
              className="flex-1 min-w-0 bg-transparent text-xs outline-none"
            />
            <span className="pl-1 text-xs text-muted-foreground/60 select-none">
              .csv
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelExport}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={!exportFilename.trim()}>
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CopyPromptsDialog open={promptsOpen} onOpenChange={setPromptsOpen} />
    </DropdownMenu>
  );
};
