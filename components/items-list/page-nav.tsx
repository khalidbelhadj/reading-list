"use client";

import { IconCards, IconChevronDown, IconSettings } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  markNavFrom,
  NAV_ITEM_ACTIVE,
  NAV_ITEM_BASE,
  NAV_ITEM_INACTIVE,
  NavLabel,
  useNavFrom,
} from "./page-nav-shared";
import { ReadingListLogo } from "./reading-list-logo";
import { SettingsMenu } from "./settings-menu";

const isRouteActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export const PageNav = ({ hasTags }: { hasTags: boolean }) => {
  const pathname = usePathname();
  const from = useNavFrom();
  const animate = from !== null;

  const stateFor = (href: string) => ({
    active: isRouteActive(pathname, href),
    wasActive: from !== null && isRouteActive(from, href),
    animate,
    onNavigate: () => markNavFrom(pathname),
  });

  const settingsState = stateFor("/settings");

  return (
    <div className="flex items-center gap-0.5">
      <NavLink href="/" label="Reading list" {...stateFor("/")}>
        <ReadingListLogo />
      </NavLink>

      <NavLink href="/review" label="Review" {...stateFor("/review")}>
        <IconCards className="size-3.5 shrink-0" />
      </NavLink>

      {/* Settings: the gear opens the full settings page; hovering reveals a
          darker chevron that slides out from behind the gear's right edge and
          opens the quick-settings dropdown. */}
      <div className="group/settings relative flex items-center">
        <NavLink
          href="/settings"
          label="Settings"
          className={cn(
            // Solid background so the gear occludes the chevron tucked behind
            // it — but only while inactive, so the active pill keeps bg-muted.
            "relative z-10",
            !settingsState.active && "bg-background",
            "group-hover/settings:bg-muted group-hover/settings:text-foreground group-has-[[aria-expanded=true]]/settings:bg-muted group-has-[[aria-expanded=true]]/settings:text-foreground",
          )}
          {...settingsState}
        >
          <IconSettings className="size-3.5 shrink-0" />
        </NavLink>
        <SettingsMenu
          hasTags={hasTags}
          trigger={
            <button
              type="button"
              aria-label="Quick settings"
              className="relative z-0 -ml-3 flex h-6 w-0 items-center justify-end overflow-hidden rounded-r-full bg-accent pr-1.5 text-muted-foreground transition-all duration-200 group-hover/settings:w-8 hover:text-foreground aria-expanded:w-8 aria-expanded:text-foreground"
            >
              <IconChevronDown className="size-3.5 shrink-0" />
            </button>
          }
        />
      </div>
    </div>
  );
};

const NavLink = ({
  href,
  label,
  active,
  wasActive,
  animate,
  onNavigate,
  className,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  wasActive: boolean;
  animate: boolean;
  onNavigate: () => void;
  className?: string;
  children: React.ReactNode;
}) => {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        NAV_ITEM_BASE,
        active ? NAV_ITEM_ACTIVE : NAV_ITEM_INACTIVE,
        className,
      )}
    >
      {children}
      <NavLabel show={active} wasActive={wasActive} animate={animate}>
        {label}
      </NavLabel>
    </Link>
  );

  // Tooltip only while collapsed — the expanded pill already shows its label.
  if (active) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};
