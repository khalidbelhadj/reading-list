import type * as React from "react";

import { cn } from "@/lib/utils";

type ImageProps = Omit<React.ComponentProps<"img">, "src"> & {
  src: string;
  alt: string;
  // next/image compat: fill maps to an absolutely-positioned img that covers
  // the (position: relative) parent — object-fit stays with the caller's
  // className, as before. sizes/unoptimized/priority were next/image
  // optimizer hints; the plain <img> ignores them.
  fill?: boolean;
  sizes?: string;
  unoptimized?: boolean;
  priority?: boolean;
};

// Drop-in replacement for the next/image usage in this app. Every call site
// rendered unoptimized favicons/thumbnails (data URLs, remote favicons,
// public assets), so a plain <img> is behaviorally identical minus the
// optimizer.
const Image = ({
  fill,
  sizes: _sizes,
  unoptimized: _unoptimized,
  priority,
  className,
  loading,
  alt,
  ...imgProps
}: ImageProps) => (
  <img
    {...imgProps}
    alt={alt}
    loading={loading ?? (priority ? "eager" : undefined)}
    className={cn(fill && "absolute inset-0 size-full", className)}
  />
);

export default Image;
