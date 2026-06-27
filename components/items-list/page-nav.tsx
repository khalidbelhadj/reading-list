"use client";

import { IconCards, IconChevronDown, IconSettings } from "@tabler/icons-react";
import { Link, useLocation } from "@tanstack/react-router";

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
  const pathname = useLocation({ select: (location) => location.pathname });
  const from = useNavFrom();
  const animate = from !== null;

  const stateFor = (href: string) => ({
    active: isRouteActive(pathname, href),
    wasActive: from !== null && isRouteActive(from, href),
    animate,
    onNavigate: () => markNavFrom(pathname),
  });

  const homeState = stateFor("/");

  return (
    <div className="flex items-center gap-0.5">
      {/* Reading list: the logo opens the list. Only while this tab is active,
          hovering reveals a darker chevron that slides out from behind the
          logo's right edge and opens the quick-settings dropdown. */}
      <div className="group/quick relative flex items-center">
        <NavLink
          href="/"
          label="Reading list"
          // Active pill sits above the chevron tucked behind it (z-0) so its
          // bg-muted occludes the chevron until it slides out on hover.
          className={homeState.active ? "relative z-10" : undefined}
          {...homeState}
        >
          <ReadingListLogo />
        </NavLink>
        {homeState.active && (
          <SettingsMenu
            hasTags={hasTags}
            trigger={
              <button
                type="button"
                aria-label="Quick settings"
                // Experiment: linger on hover-out. The 1s transition-delay only
                // applies when collapsing back to the resting state; hovering
                // (and opening the menu) zeroes it so the chevron still appears
                // instantly.
                className="relative z-0 -ml-3 flex h-6 w-3 items-center justify-end overflow-hidden rounded-r-full bg-accent pr-1.5 text-muted-foreground transition-all delay-[1000ms] duration-200 group-hover/quick:w-8 group-hover/quick:delay-0 hover:text-foreground aria-expanded:w-8 aria-expanded:text-foreground aria-expanded:delay-0"
              >
                <IconChevronDown className="size-3.5 shrink-0" />
              </button>
            }
          />
        )}
      </div>

      <NavLink href="/review" label="Review" {...stateFor("/review")}>
        <IconCards className="size-3.5 shrink-0" />
      </NavLink>

      <NavLink href="/settings" label="Settings" {...stateFor("/settings")}>
        <IconSettings className="size-3.5 shrink-0" />
      </NavLink>
    </div>
  );
};

// The handful of in-SPA destinations the nav links to. Kept as a literal union
// so TanStack Link's typed `to` is satisfied without a cast.
type NavHref = "/" | "/review" | "/settings";

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
  href: NavHref;
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
      to={href}
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
