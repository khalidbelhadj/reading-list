import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stand-in for DetailPanel while item data is loading. Mirrors the panel's
 * outer structure so the morphing wrapper has a stable shape.
 */
export const DetailPanelSkeleton = () => (
  <div className="flex flex-col gap-2 w-full">
    {/* Item form card */}
    <div className="rounded-lg bg-card px-3 py-3 flex flex-col gap-2">
      {/* Title row: favicon + title + actions */}
      <div className="flex items-center gap-2">
        <Skeleton className="size-5 rounded shrink-0" />
        <Skeleton className="h-3.5 flex-1 rounded" />
      </div>
      {/* URL */}
      <Skeleton className="h-3 w-2/3 rounded" />
      {/* Tags */}
      <Skeleton className="h-4 w-1/3 rounded" />
      {/* Notes */}
      <div className="flex flex-col gap-1.5 mt-1">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-11/12 rounded" />
        <Skeleton className="h-3 w-3/4 rounded" />
      </div>
    </div>

    {/* Add card placeholder */}
    <Skeleton className="h-9 rounded-lg" />

    {/* Flashcard placeholders */}
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} style={{ opacity: Math.max(1 - i * 0.2, 0.2) }}>
        <Skeleton className="h-22 rounded-lg" />
      </div>
    ))}
  </div>
);
