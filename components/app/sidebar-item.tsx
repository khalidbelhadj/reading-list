import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type React from "react";

import { cn } from "@/lib/utils";

// A row in the sidebar: icon, label, optional trailing count. Renders as an
// anchor by default; pass `render={<Link … />}` for router links. Active
// comes from `active` or from the router's own `data-status="active"`.
// `trailing` sits at the right edge for a secondary affordance (e.g. a
// hover-revealed action); it renders after the count.
export const SidebarItem = ({
  icon,
  label,
  count,
  trailing,
  active,
  className,
  render,
  ...props
}: useRender.ComponentProps<"a"> & {
  icon?: React.ReactNode;
  label: React.ReactNode;
  count?: React.ReactNode;
  trailing?: React.ReactNode;
  active?: boolean;
}) =>
  useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "flex h-sidebar-row items-center gap-2 rounded-control px-2 text-body font-medium text-muted-foreground outline-none select-none hover:bg-foreground/[0.05] hover:text-foreground focus-visible:bg-foreground/[0.05] data-[active]:bg-foreground/[0.07] data-[active]:text-foreground data-[status=active]:bg-foreground/[0.07] data-[status=active]:text-foreground [&>svg]:size-3.5 [&>svg]:shrink-0",
          className,
        ),
        children: (
          <>
            {icon}
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {count !== undefined && (
              <span className="text-small text-muted-foreground tabular-nums">
                {count}
              </span>
            )}
            {trailing}
          </>
        ),
      },
      props,
    ),
    render,
    // Becomes data-active="" when true (useRender drops false).
    state: { slot: "sidebar-item", active: Boolean(active) },
  });
