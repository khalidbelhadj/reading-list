import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stand-in for the item-form portion of DetailPanel while item data is
 * loading. Card skeletons are handled inside DetailPanel itself once the
 * item is known and the cards query is in-flight.
 */
export const DetailPanelSkeleton = () => (
  <div className="flex flex-col gap-2 w-full">
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Skeleton className="size-5 rounded shrink-0" />
        <Skeleton className="h-5 flex-1 rounded" />
      </div>
      <Skeleton className="h-3 w-2/3 rounded" />
      <Skeleton className="h-4 w-1/3 rounded" />
      <div className="flex flex-col gap-1.5 mt-1">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-11/12 rounded" />
        <Skeleton className="h-3 w-3/4 rounded" />
      </div>
    </div>
  </div>
);
