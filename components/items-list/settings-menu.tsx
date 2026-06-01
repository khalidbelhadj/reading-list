"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IconCalendar,
  IconCards,
  IconChevronDown,
  IconCircleOff,
  IconDeviceDesktop,
  IconDownload,
  IconEye,
  IconFilter,
  IconArrowsMaximize,
  IconBook,
  IconLayoutList,
  IconList,
  IconListDetails,
  IconLogout,
  IconMoon,
  IconPalette,
  IconSun,
  IconTag,
} from "@tabler/icons-react";

import { logout } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type TabId, type GroupBy } from "@/components/items-list/use-filters";
import { useSettings } from "@/lib/use-settings";
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

type ThemeKey = "system" | "light" | "dark";

const THEME_LABELS: Record<ThemeKey, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const THEME_ICONS: Record<
  ThemeKey,
  React.ComponentType<{ className?: string }>
> = {
  system: IconDeviceDesktop,
  light: IconSun,
  dark: IconMoon,
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

const TAB_ICONS: Record<TabId, React.ComponentType<{ className?: string }>> = {
  "reading-list": IconBook,
  cards: IconCards,
};

const GROUP_BY_LABELS: Record<GroupBy, string> = {
  none: "None",
  tag: "Tag",
  day: "Date",
};

const GROUP_BY_ICONS: Record<
  GroupBy,
  React.ComponentType<{ className?: string }>
> = {
  none: IconCircleOff,
  tag: IconTag,
  day: IconCalendar,
};

export const SettingsMenu = ({
  activeTab,
  setActiveTabAndUrl,
  showFilters,
  showReadingListFilters,
  hasTags,
}: {
  activeTab: TabId;
  setActiveTabAndUrl: (tab: TabId) => void;
  showFilters: boolean;
  showReadingListFilters: boolean;
  hasTags: boolean;
}) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const { settings, setSetting } = useSettings();
  const { theme, density, fullWidth, groupBy, showRead, tagsOpen } = settings;
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
  const [mounted, setMounted] = React.useState(false);
  const [isElectron, setIsElectron] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [exportFilename, setExportFilename] =
    React.useState(defaultCsvFilename());

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
    },
  });

  const handleThemeChange = React.useCallback(
    (value: string) => setSetting("theme", value as ThemeKey),
    [setSetting],
  );

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

  const handleTagsOpenChange = React.useCallback(
    (checked: boolean) => setSetting("tagsOpen", checked),
    [setSetting],
  );

  const handleShowReadChange = React.useCallback(
    (checked: boolean) => setSetting("showRead", checked),
    [setSetting],
  );

  const handleGroupByChange = React.useCallback(
    (value: string) => setSetting("groupBy", value as GroupBy),
    [setSetting],
  );

  const handleDensityChange = React.useCallback(
    (value: string) => setSetting("density", value === "cozy" ? "cozy" : "compact"),
    [setSetting],
  );

  const handleFullWidthChange = React.useCallback(
    (checked: boolean) => setSetting("fullWidth", checked),
    [setSetting],
  );

  React.useEffect(() => {
    setMounted(true);
    setIsElectron(document.documentElement.classList.contains("electron"));
  }, []);

  // Apply theme to <html>. Watches both settings.theme and the system dark
  // media query so "system" tracks OS changes without a manual toggle.
  React.useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  React.useEffect(() => {
    document.documentElement.classList.toggle("full-width", fullWidth);
  }, [fullWidth]);


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
        {(Object.keys(TAB_LABELS) as TabId[]).map((key) => {
          const TabIcon = TAB_ICONS[key];
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => setActiveTabAndUrl(key)}
              className={cn(
                activeTab === key && "bg-secondary focus:bg-secondary",
              )}
            >
              <TabIcon />
              {TAB_LABELS[key]}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        {showFilters && (
          <>
            {showReadingListFilters && (
              <DropdownMenuCheckboxItem
                checked={showRead}
                onCheckedChange={handleShowReadChange}
                >
                <IconEye />
                Show read items
              </DropdownMenuCheckboxItem>
            )}
            <DropdownMenuCheckboxItem
              checked={tagsOpen}
              onCheckedChange={handleTagsOpenChange}
              disabled={!hasTags}
            >
              <IconFilter />
              Filter by tags
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        )}
        {showFilters && (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <IconLayoutList />
                Group by
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={groupBy}
                  onValueChange={handleGroupByChange}
                >
                  {(Object.keys(GROUP_BY_LABELS) as GroupBy[]).map((key) => {
                    const GroupIcon = GROUP_BY_ICONS[key];
                    return (
                      <DropdownMenuRadioItem key={key} value={key}>
                        <GroupIcon />
                        {GROUP_BY_LABELS[key]}
                      </DropdownMenuRadioItem>
                    );
                  })}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <IconList />
                Density
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={density}
                  onValueChange={handleDensityChange}
                >
                  <DropdownMenuRadioItem value="compact">
                    <IconList />
                    Compact
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="cozy">
                    <IconListDetails />
                    Cozy
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconPalette />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={handleThemeChange}
            >
              {(Object.keys(THEME_LABELS) as ThemeKey[]).map((key) => {
                const ThemeIcon = THEME_ICONS[key];
                return (
                  <DropdownMenuRadioItem key={key} value={key}>
                    <ThemeIcon />
                    {THEME_LABELS[key]}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {mounted && isElectron && (
          <DropdownMenuCheckboxItem
            checked={fullWidth}
            onCheckedChange={handleFullWidthChange}
          >
            <IconArrowsMaximize />
            Full width
          </DropdownMenuCheckboxItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openExport}>
          <IconDownload />
          Export as CSV
        </DropdownMenuItem>
        {mounted && (fullName || email) && (
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
              <DropdownMenuItem onClick={handleLogout}>
                <IconLogout />
                Log out
              </DropdownMenuItem>
              {email && (
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                    {email}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
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

    </DropdownMenu>
  );
};
