import { Skeleton } from "@/components/ui/skeleton";

import { type Density } from "./utils";

// One width sequence drives both densities so the rhythm down the list reads
// the same, and the url bar in cozy mode is derived from the same row width so
// each row looks coherent.
const TITLE_WIDTHS = [24, 18, 30, 14, 22, 28, 16, 26];

// Placeholder rows for the items list. Used both for the initial full-list load
// and, with a small `count`, appended under the instant keyword results while
// the backend (trigram) search is still in flight — so a search reads as
// "here's what matched the title, more coming" rather than looking finished.
export const ItemsSkeleton = ({
  density,
  count = 15,
}: {
  density: Density;
  count?: number;
}) => (
  <div className="flex flex-col space-y-px">
    {Array.from({ length: count }).map((_, i) => {
      const titleRem = TITLE_WIDTHS[i % TITLE_WIDTHS.length];
      const urlRem = titleRem * 0.55;
      const opacity = Math.max(1 - i * 0.07, 0.1);
      if (density === "cozy") {
        return (
          <div
            key={i}
            style={{ opacity }}
            className="flex items-stretch gap-3 p-2"
          >
            <Skeleton className="aspect-video w-24 shrink-0 rounded-[3px]" />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
              <Skeleton
                className="h-3.5 rounded-md"
                style={{ width: `min(${titleRem}rem, 85%)` }}
              />
              <Skeleton
                className="h-3 rounded-md"
                style={{ width: `min(${urlRem}rem, 60%)` }}
              />
            </div>
          </div>
        );
      }
      return (
        <div
          key={i}
          style={{ opacity }}
          className="flex items-center gap-2 p-1 h-7"
        >
          <Skeleton className="size-4 rounded-[3px] shrink-0" />
          <Skeleton
            className="h-3 rounded-md"
            style={{ width: `min(${titleRem}rem, 85%)` }}
          />
        </div>
      );
    })}
  </div>
);
