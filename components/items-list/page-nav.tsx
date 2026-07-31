import { IconCards, IconChevronDown, IconSettings } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

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
  NavPill,
  useNavFrom,
} from "./page-nav-shared";
import { ReadingListLogo } from "./reading-list-logo";
import { SettingsMenu } from "./settings-menu";

const isRouteActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

// The handful of in-SPA destinations the nav links to. Kept as a literal union
// so TanStack Link's typed `to` is satisfied without a cast.
type NavHref = "/" | "/review" | "/settings";

export const PageNav = ({
  current,
  hasTags,
  compact = false,
}: {
  // The tab this copy of the nav belongs to — the route of the page rendering
  // it, not whatever the router currently points at. Deliberately *not* read
  // from router state: a navigation renders three navs in quick succession (the
  // outgoing page's, then the destination's), and any of them observing the
  // location mid-flight would start the pill animation in a nav that is about
  // to be unmounted, so it replays from scratch in the one that survives. On a
  // route's first visit the chunk load stretches that gap to ~50ms — long
  // enough to see the animation stutter and restart. Owning the value here
  // makes each nav's active tab fixed for its whole life, so the animation
  // starts once, on mount, in the nav that stays.
  current: NavHref;
  hasTags: boolean;
  compact?: boolean;
}) => {
  const from = useNavFrom();
  const animate = from !== null;

  const stateFor = (href: NavHref) => ({
    active: current === href,
    // `from` is a raw pathname, so it still needs prefix matching (a review
    // session hands off to the Review tab).
    wasActive: from !== null && isRouteActive(from, href),
    animate,
    compact,
    onNavigate: () => markNavFrom(current),
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
          // background occludes the chevron until it slides out on hover.
          className={homeState.active ? "z-10" : undefined}
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
      <NavPill active={active} wasActive={wasActive} animate={animate} />
      {/* Positioned so the icon and label paint above the pill layer. */}
      <span className="relative flex items-center">
        {children}
        <NavLabel show={showLabel} wasActive={wasActive} animate={animate}>
          {label}
        </NavLabel>
      </span>
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
