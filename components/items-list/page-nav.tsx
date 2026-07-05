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

export const PageNav = ({
  hasTags,
  compact = false,
}: {
  hasTags: boolean;
  compact?: boolean;
}) => {
  const pathname = useLocation({ select: (location) => location.pathname });
  const from = useNavFrom();
  const animate = from !== null;

  const stateFor = (href: string) => ({
    active: isRouteActive(pathname, href),
    wasActive: from !== null && isRouteActive(from, href),
    animate,
    compact,
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
                // Chevron slides out on hover / while the menu is open, and
                // collapses immediately on hover-out. No transition-delay: a
                // collapse delay holds the width at whatever partial value a
                // rapid hover-out lands on, which reads as the animation pausing
                // half-way. Scope the transition to width/color — transition-all
                // would also animate layout changes on navigation, which freezes
                // the width mid-collapse when the route (and this row) re-renders.
                className="relative z-0 -ml-3 flex h-6 w-3 items-center justify-end overflow-hidden rounded-r-full bg-accent pr-1.5 text-muted-foreground transition-[width,color] duration-200 group-hover/quick:w-8 hover:text-foreground aria-expanded:w-8 aria-expanded:text-foreground"
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
  compact,
  onNavigate,
  className,
  children,
}: {
  href: NavHref;
  label: string;
  active: boolean;
  wasActive: boolean;
  animate: boolean;
  compact: boolean;
  onNavigate: () => void;
  className?: string;
  children: React.ReactNode;
}) => {
  // When compact, the active tab collapses to icon-only (keeping its active
  // background) so the label doesn't crowd out the toolbar's right-side buttons.
  const showLabel = active && !compact;
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
      <NavLabel show={showLabel} wasActive={wasActive} animate={animate}>
        {label}
      </NavLabel>
    </Link>
  );

  // Always keep the Tooltip wrapper mounted so toggling the label (compact
  // collapse, or activating a tab) doesn't remount the Link — that would reset
  // the NavLabel motion and snap the width instead of animating it. The tooltip
  // content is only rendered while the label is hidden; the expanded pill
  // already shows its label.
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      {!showLabel && <TooltipContent>{label}</TooltipContent>}
    </Tooltip>
  );
};
