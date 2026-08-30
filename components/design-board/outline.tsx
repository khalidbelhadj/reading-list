import { useLocation } from "@tanstack/react-router";
import React from "react";

import { SidebarItem } from "@/components/app/sidebar-item";

// The slug a board section's id and its outline link share.
export const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export type OutlineGroup = { label?: string; entries: string[] };

export const FOUNDATION_SECTIONS: OutlineGroup[] = [
  { entries: ["Colour", "Type", "Shape", "Density and motion"] },
];
export const ROUND_SECTIONS: OutlineGroup[] = [
  {
    entries: [
      "10. Flashcards",
      "9. Favicons",
      "5. Matcha",
      "6. Type scale",
      "7. Surface edge",
      "8. Density",
      "1. Warmth",
      "2. Accent",
      "3. Radius",
      "4. Glass",
    ],
  },
];

// Left outline for the board: one link per section of the current page,
// highlighting the one nearest the top of the viewport.
export const Outline = ({ groups }: { groups: OutlineGroup[] }) => {
  const { hash } = useLocation();
  const [current, setCurrent] = React.useState<string | null>(null);
  const entries = React.useMemo(
    () => groups.flatMap((group) => group.entries),
    [groups],
  );

  React.useEffect(() => {
    const targets = entries
      .map((entry) => document.getElementById(slug(entry)))
      .filter((element): element is HTMLElement => element !== null);
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (observations) => {
        const visible = observations
          .filter((observation) => observation.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first) setCurrent(first.target.id);
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [entries]);

  const active =
    current ?? (hash ? hash.replace(/^#/, "") : slug(entries[0] ?? ""));

  return (
    <nav aria-label="On this page" className="flex flex-col gap-4">
      {groups.map((group, index) => (
        <div key={group.label ?? index} className="flex flex-col gap-0.5">
          {group.label && (
            <p className="px-2 pb-1 text-micro font-medium text-muted-foreground">
              {group.label}
            </p>
          )}
          {group.entries.map((entry) => {
            const id = slug(entry);
            return (
              <SidebarItem
                key={id}
                href={`#${id}`}
                label={entry}
                active={active === id}
              />
            );
          })}
        </div>
      ))}
    </nav>
  );
};
