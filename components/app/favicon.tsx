import { IconFileFilled } from "@tabler/icons-react";
import React from "react";

import { faviconSrc } from "@/lib/favicon";
import { cn } from "@/lib/utils";

// An item's favicon, shown bare: the icon as the site serves it, nothing
// behind it (the tile treatment was tried and rejected on the board). Falls
// back to a file glyph when there is no URL, and to the same glyph if the
// image fails to load.
export const Favicon = ({
  item,
  size = 16,
  className,
}: {
  item: { faviconUrl?: string | null; url: string };
  size?: number;
  className?: string;
}) => {
  const src = faviconSrc(item);
  const [failed, setFailed] = React.useState(false);
  const handleError = React.useCallback(() => setFailed(true), []);

  if (!src || failed) {
    return (
      <IconFileFilled
        data-slot="favicon"
        className={cn("shrink-0 text-muted-foreground", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      data-slot="favicon"
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={handleError}
      className={cn("shrink-0 rounded-[3px] object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
};
