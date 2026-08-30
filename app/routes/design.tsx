import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";

import { COMPONENT_GROUPS } from "@/components/design-board/components-page";
import {
  FOUNDATION_SECTIONS,
  Outline,
  type OutlineGroup,
  ROUND_SECTIONS,
} from "@/components/design-board/outline";

const TAB =
  "flex h-6 items-center rounded-control px-2.5 text-small font-medium text-muted-foreground outline-none hover:text-foreground data-[status=active]:bg-foreground/[0.07] data-[status=active]:text-foreground";

const COMPONENT_OUTLINE: OutlineGroup[] = COMPONENT_GROUPS.map((group) => ({
  label: group.label,
  entries: group.demos.map(({ demo }) => demo.title),
}));

const outlineFor = (pathname: string): OutlineGroup[] => {
  if (pathname.startsWith("/design/components")) return COMPONENT_OUTLINE;
  if (pathname.startsWith("/design/rounds")) return ROUND_SECTIONS;
  return FOUNDATION_SECTIONS;
};

// The design board: DESIGN.md rendered live, every kit component's demo, and
// the candidate rounds the decisions came from. A left outline tracks the
// sections of whichever page is open.
const DesignLayout = () => {
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex max-w-6xl gap-10 px-8 pt-14 pb-24">
        <aside className="sticky top-14 hidden max-h-[calc(100dvh-4.5rem)] w-48 shrink-0 flex-col gap-6 self-start overflow-y-auto pb-6 md:flex">
          <div className="flex flex-col gap-3">
            <h1 className="px-2 font-content text-title font-semibold">
              Design system
            </h1>
            <nav className="flex flex-col gap-0.5">
              <Link
                to="/design"
                activeOptions={{ exact: true }}
                className={TAB}
              >
                Foundations
              </Link>
              <Link to="/design/components" className={TAB}>
                Components
              </Link>
              <Link to="/design/rounds" className={TAB}>
                Rounds
              </Link>
            </nav>
          </div>
          <div className="flex flex-col gap-2">
            <p className="px-2 text-micro font-medium text-muted-foreground">
              On this page
            </p>
            <Outline groups={outlineFor(pathname)} />
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/design")({
  component: DesignLayout,
});
