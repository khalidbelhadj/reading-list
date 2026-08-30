import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's default scales. Without this it reads
// the design system's named utilities as something else (`text-body` as a
// text colour, so a later `text-foreground` silently deletes it) and drops
// them while resolving conflicts. Register each custom scale in its group.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-micro",
        "text-small",
        "text-body",
        "text-title",
        "text-heading",
        "text-display",
      ],
      rounded: ["rounded-control", "rounded-surface"],
      shadow: ["shadow-surface"],
      h: ["h-row", "h-sidebar-row"],
      "min-h": ["min-h-row", "min-h-sidebar-row"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
