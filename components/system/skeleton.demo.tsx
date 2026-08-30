import { type Demo } from "./demo";
import { Skeleton } from "./skeleton";

export const demo: Demo = {
  title: "Skeleton",
  description:
    "Stands in for content while it loads; mirror the shape of what arrives.",
  render: () => (
    <div className="flex max-w-sm flex-col gap-2">
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-row w-full" />
      <Skeleton className="h-row w-full" />
    </div>
  ),
};
