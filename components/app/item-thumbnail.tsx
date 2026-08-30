import React from "react";

import { getYouTubeVideoId } from "@/lib/url";
import { cn } from "@/lib/utils";

import { Favicon } from "./favicon";

// A small "page" that peeks up from the bottom of the thumbnail, like a
// sheet of paper emerging from a tinted tray. A stored preview image (e.g.
// an arxiv PDF first-page render) fills the page; otherwise a stylized
// title + content lines stand in.
const PagePreview = ({
  title,
  previewImageUrl,
}: {
  title: string;
  previewImageUrl: string | null;
}) => (
  <div className="absolute inset-0 bg-foreground/[0.05]">
    <div className="absolute inset-x-3 top-2 bottom-[-30%] overflow-hidden rounded-t-[3px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.18)] dark:bg-zinc-100">
      {previewImageUrl ? (
        <img
          src={previewImageUrl}
          alt=""
          className="size-full object-cover object-top"
        />
      ) : (
        <div className="flex flex-col gap-[3px] px-1.5 pt-1.5">
          <div className="line-clamp-2 text-[6px] leading-[1.2] font-semibold text-zinc-900">
            {title}
          </div>
          <div className="mt-0.5 h-0.5 w-full rounded-full bg-zinc-300" />
          <div className="h-0.5 w-[88%] rounded-full bg-zinc-300" />
          <div className="h-0.5 w-[70%] rounded-full bg-zinc-300" />
        </div>
      )}
    </div>
  </div>
);

// The preview thumbnail for cozy rows: a YouTube thumbnail when the URL is a
// video, otherwise the "page" preview (a stored PDF first-page render, or a
// stylized placeholder), with a favicon badge in the corner. Presentation
// only — the caller resolves `previewImageUrl` (see use-item-preview in the
// shell). `className` sizes the outer box.
export const ItemThumbnail = ({
  item,
  previewImageUrl,
  className,
}: {
  item: { url: string; title: string; faviconUrl?: string | null };
  previewImageUrl: string | null;
  className?: string;
}) => {
  const youtubeId = item.url ? getYouTubeVideoId(item.url) : null;
  const [thumbFailed, setThumbFailed] = React.useState(false);

  return (
    <div
      data-slot="item-thumbnail"
      className={cn(
        "relative overflow-hidden bg-foreground/[0.05] ring-1 ring-foreground/5",
        className,
      )}
    >
      {youtubeId && !thumbFailed ? (
        <img
          src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setThumbFailed(true)}
        />
      ) : (
        <PagePreview
          title={item.title?.trim() || "Untitled"}
          previewImageUrl={previewImageUrl}
        />
      )}
      <div className="absolute right-1 bottom-1 flex size-4 items-center justify-center rounded-[3px] bg-background/90 ring-1 ring-foreground/10">
        <Favicon item={item} size={12} className="rounded-[2px]" />
      </div>
    </div>
  );
};
