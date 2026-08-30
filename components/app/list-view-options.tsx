import {
  IconArrowsSort,
  IconCalendar,
  IconCircleOff,
  IconEye,
  IconEyeOff,
  IconLayoutList,
  IconListDetails,
  IconSortAscending,
  IconSortDescending,
} from "@tabler/icons-react";
import type React from "react";

import { Button } from "@/components/system/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuTrigger,
} from "@/components/system/menu";
import { Tooltip } from "@/components/system/tooltip";
import { cn } from "@/lib/utils";

export type ListGroupBy = "day" | "none";
export type ListSortBy =
  "created-desc" | "created-asc" | "updated-desc" | "updated-asc";
export type ListDensity = "compact" | "preview";

const GROUPS: Array<{
  value: ListGroupBy;
  label: string;
  Icon: typeof IconCalendar;
}> = [
  { value: "day", label: "By date", Icon: IconCalendar },
  { value: "none", label: "No groups", Icon: IconCircleOff },
];

const SORTS: Array<{
  value: ListSortBy;
  label: string;
  Icon: typeof IconCalendar;
}> = [
  { value: "created-desc", label: "Newest first", Icon: IconSortDescending },
  { value: "created-asc", label: "Oldest first", Icon: IconSortAscending },
  {
    value: "updated-desc",
    label: "Recently updated",
    Icon: IconSortDescending,
  },
  {
    value: "updated-asc",
    label: "Least recently updated",
    Icon: IconSortAscending,
  },
];

const DENSITIES: Array<{
  value: ListDensity;
  label: string;
  Icon: typeof IconCalendar;
}> = [
  { value: "compact", label: "Compact", Icon: IconLayoutList },
  { value: "preview", label: "Preview", Icon: IconListDetails },
];

const OptionMenu = <T extends string>({
  tooltip,
  icon,
  options,
  value,
  onChange,
}: {
  tooltip: string;
  icon: React.ReactNode;
  options: Array<{ value: T; label: string; Icon: typeof IconCalendar }>;
  value: T;
  onChange: (value: T) => void;
}) => (
  <Menu>
    <Tooltip content={tooltip}>
      <MenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={tooltip} />}
      >
        {icon}
      </MenuTrigger>
    </Tooltip>
    <MenuContent align="start">
      {options.map(({ value: option, label, Icon }) => (
        <MenuCheckboxItem
          key={option}
          icon={<Icon />}
          checked={value === option}
          onCheckedChange={() => onChange(option)}
        >
          {label}
        </MenuCheckboxItem>
      ))}
    </MenuContent>
  </Menu>
);

// The row of view options under a list's search bar: show-read toggle, group,
// sort, and density, each an icon button. Presentation only — values and
// writes come from the caller.
export const ListViewOptions = ({
  showRead,
  onShowReadChange,
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  density,
  onDensityChange,
  className,
}: {
  showRead: boolean;
  onShowReadChange: (showRead: boolean) => void;
  groupBy: ListGroupBy;
  onGroupByChange: (groupBy: ListGroupBy) => void;
  sortBy: ListSortBy;
  onSortByChange: (sortBy: ListSortBy) => void;
  density: ListDensity;
  onDensityChange: (density: ListDensity) => void;
  className?: string;
}) => (
  <div
    data-slot="list-view-options"
    className={cn("flex items-center gap-0.5", className)}
  >
    <Tooltip content={showRead ? "Hide read items" : "Show read items"}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={showRead ? "Hide read items" : "Show read items"}
        aria-pressed={showRead}
        onClick={() => onShowReadChange(!showRead)}
        className={cn(showRead && "bg-foreground/[0.05] text-foreground")}
      >
        {showRead ? <IconEye /> : <IconEyeOff />}
      </Button>
    </Tooltip>
    <OptionMenu
      tooltip="Group"
      icon={<IconLayoutList />}
      options={GROUPS}
      value={groupBy}
      onChange={onGroupByChange}
    />
    <OptionMenu
      tooltip="Sort"
      icon={<IconArrowsSort />}
      options={SORTS}
      value={sortBy}
      onChange={onSortByChange}
    />
    <OptionMenu
      tooltip="Density"
      icon={<IconListDetails />}
      options={DENSITIES}
      value={density}
      onChange={onDensityChange}
    />
  </div>
);
