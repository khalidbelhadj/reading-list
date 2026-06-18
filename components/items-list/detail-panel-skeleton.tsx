import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stand-in for the item-form portion of DetailPanel while item data is
 * loading. Card skeletons are handled inside DetailPanel itself once the
 * item is known and the cards query is in-flight.
 */
export const DetailPanelSkeleton = () => (
  <div className="flex w-full flex-col gap-2">
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 shrink-0 rounded-sm" />
        <Skeleton className="h-7 flex-1 rounded" />
      </div>
      <Skeleton className="h-4 w-2/3 rounded" />
      <Skeleton className="h-5 w-1/3 rounded" />
      <div className="mt-1 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-full rounded" />
        <Skeleton className="h-3.5 w-11/12 rounded" />
        <Skeleton className="h-3.5 w-3/4 rounded" />
      </div>
    </div>
  </div>
);
