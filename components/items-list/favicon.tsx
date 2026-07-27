import { IconFileFilled } from "@tabler/icons-react";

import Image from "@/components/ui/image";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

import { getFaviconSrc } from "./utils";

// Faint, theme-adaptive tile behind favicons. The 6% foreground wash fills the
// transparent regions of icons and the 1px inset frames edge-to-edge ones, so
// favicons of any shape read as a consistent, clear glyph against any surface.
const chipClass = "rounded-[3px] bg-foreground/[0.06] object-contain p-px";

// Single source of truth for rendering an item's favicon (or a file-icon
// fallback when the URL yields no favicon). Pass sizing via `className`
// (e.g. `size-4`, `size-full`); `size` sets the intrinsic pixel dimensions.
export const Favicon = ({
  item,
  size = 16,
  className,
}: {
  item: Pick<Item, "faviconUrl" | "url">;
  size?: number;
  className?: string;
}) => {
  const src = getFaviconSrc(item);

  if (!src) {
    return (
      <IconFileFilled className={cn("text-muted-foreground", className)} />
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn(chipClass, className)}
      unoptimized
    />
  );
};
