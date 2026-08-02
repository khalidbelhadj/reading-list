// The list toolbar's settings dropdown: view options (show read/suggestions/
// tags, group/sort/density/theme), export, and the account submenu. Pure
// settings *writes* — the global theme/full-width effects live in
// components/settings-effects.tsx.
import {
  IconAppWindow,
  IconArrowsMaximize,
  IconArrowsSort,
  IconBrain,
  IconBulb,
  IconCalendar,
  IconCircleOff,
  IconDeviceDesktop,
  IconDownload,
  IconEye,
  IconFilter,
  IconLayoutList,
  IconList,
  IconListDetails,
  IconMoon,
  IconPalette,
  IconSortAscending,
  IconSortDescending,
  IconSun,
  IconTag,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import React from "react";

import { ElectronOnly } from "@/components/electron-only";
import { type GroupBy, type SortBy } from "@/components/items-list/use-filters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSwitchItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettings } from "@/lib/use-settings";

import { AccountMenu } from "./account-menu";
import { ExportCsvDialog } from "./export-csv-dialog";

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

const GROUP_BY_LABELS: Record<GroupBy, string> = {
  day: "Date",
  tag: "Tag",
  none: "None",
};

const GROUP_BY_ICONS: Record<
  GroupBy,
  React.ComponentType<{ className?: string }>
> = {
  day: IconCalendar,
  tag: IconTag,
  none: IconCircleOff,
};

const SORT_BY_LABELS: Record<SortBy, string> = {
  "created-desc": "Newest first",
  "created-asc": "Oldest first",
  "updated-desc": "Recently updated",
  "updated-asc": "Least recently updated",
};

const SORT_BY_ICONS: Record<
  SortBy,
  React.ComponentType<{ className?: string }>
> = {
  "created-desc": IconSortDescending,
  "created-asc": IconSortAscending,
  "updated-desc": IconSortDescending,
  "updated-asc": IconSortAscending,
};

export const SettingsMenu = ({
  hasTags,
  trigger,
}: {
  hasTags: boolean;
  trigger: React.ReactElement;
}) => {
  const navigate = useNavigate();
  const { settings, setSetting } = useSettings();
  const {
    theme,
    density,
    fullWidth,
    groupBy,
    sortBy,
    showRead,
    showSuggestions,
    tagsOpen,
    reviewsInNewWindow,
  } = settings;
  const [exportOpen, setExportOpen] = React.useState(false);

  const handleThemeChange = React.useCallback(
    (value: string) => setSetting("theme", value as ThemeKey),
    [setSetting],
  );

  const openExport = React.useCallback(() => {
    setExportOpen(true);
  }, []);

  const handleNavigateToIntelligence = React.useCallback(() => {
    void navigate({ to: "/debug/intelligence" });
  }, [navigate]);

  const handleTagsOpenChange = React.useCallback(
    (checked: boolean) => setSetting("tagsOpen", checked),
    [setSetting],
  );

  const handleShowReadChange = React.useCallback(
    (checked: boolean) => setSetting("showRead", checked),
    [setSetting],
  );

  const handleShowSuggestionsChange = React.useCallback(
    (checked: boolean) => setSetting("showSuggestions", checked),
    [setSetting],
  );

  const handleGroupByChange = React.useCallback(
    (value: string) => setSetting("groupBy", value as GroupBy),
    [setSetting],
  );

  const handleSortByChange = React.useCallback(
    (value: string) => setSetting("sortBy", value as SortBy),
    [setSetting],
  );

  const handleDensityChange = React.useCallback(
    (value: string) =>
      setSetting("density", value === "cozy" ? "cozy" : "compact"),
    [setSetting],
  );

  const handleFullWidthChange = React.useCallback(
    (checked: boolean) => setSetting("fullWidth", checked),
    [setSetting],
  );

  const handleReviewsInNewWindowChange = React.useCallback(
    (checked: boolean) => setSetting("reviewsInNewWindow", checked),
    [setSetting],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align="start" sideOffset={6} className="min-w-48">
        <DropdownMenuSwitchItem
          checked={showRead}
          onCheckedChange={handleShowReadChange}
        >
          <IconEye />
          Show read items
        </DropdownMenuSwitchItem>
        <DropdownMenuSwitchItem
          checked={showSuggestions}
          onCheckedChange={handleShowSuggestionsChange}
        >
          <IconBulb />
          Show suggestions
        </DropdownMenuSwitchItem>
        <DropdownMenuSwitchItem
          checked={tagsOpen}
          onCheckedChange={handleTagsOpenChange}
          disabled={!hasTags}
        >
          <IconFilter />
          Filter by tags
        </DropdownMenuSwitchItem>
        <DropdownMenuSeparator />
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
            <IconArrowsSort />
            Sort by
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={sortBy}
              onValueChange={handleSortByChange}
            >
              {(Object.keys(SORT_BY_LABELS) as SortBy[]).map((key) => {
                const SortIcon = SORT_BY_ICONS[key];
                return (
                  <DropdownMenuRadioItem key={key} value={key}>
                    <SortIcon />
                    {SORT_BY_LABELS[key]}
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
              <DropdownMenuRadioItem value="cozy">
                <IconListDetails />
                Cozy
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="compact">
                <IconList />
                Compact
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
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
        <DropdownMenuSwitchItem
          checked={reviewsInNewWindow}
          onCheckedChange={handleReviewsInNewWindowChange}
        >
          <IconAppWindow />
          Reviews in new window
        </DropdownMenuSwitchItem>
        {/* Full width only means something inside the desktop window. */}
        <ElectronOnly>
          <DropdownMenuSwitchItem
            checked={fullWidth}
            onCheckedChange={handleFullWidthChange}
          >
            <IconArrowsMaximize />
            Full width
          </DropdownMenuSwitchItem>
        </ElectronOnly>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openExport}>
          <IconDownload />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleNavigateToIntelligence}>
          <IconBrain />
          Intelligence
        </DropdownMenuItem>
        <AccountMenu />
      </DropdownMenuContent>

      <ExportCsvDialog open={exportOpen} onOpenChange={setExportOpen} />
    </DropdownMenu>
  );
};
