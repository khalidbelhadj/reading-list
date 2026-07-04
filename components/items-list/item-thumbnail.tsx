import { IconFileFilled } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "@/components/ui/image";
import React from "react";

import { generateItemPreview } from "@/app/actions";
import { fetchItemPreviews } from "@/lib/queries";
import { type Item } from "@/lib/types";
import { getYouTubeVideoId } from "@/lib/url";
import { cn } from "@/lib/utils";

import { getFaviconSrc } from "./utils";

const getYouTubeThumb = (item: Pick<Item, "url">): string | null => {
  if (!item.url) return null;
  const ytId = getYouTubeVideoId(item.url);
  if (ytId) return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  return null;
};

// Single-flight set so we don't fire duplicate generation requests for the
// same item across re-mounts (e.g. virtualized rows scrolling in and out, or
// the same item appearing in both the suggested strip and the cozy list).
const inFlight = new Set<string>();

// Cheap pre-filter to skip URLs we won't probe (e.g. mailto:, magnet:). We
// don't try to detect PDF-ness here — that's the server's job via magic-
// byte sniff. We only want to avoid wasted server actions on non-http(s).
const isProbeableUrl = (raw: string | null | undefined): boolean => {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const getDomain = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

// A small "page" shape that peeks up from the bottom of the preview card,
// like a sheet of paper emerging from a tinted tray. If the item has a
// stored preview image (e.g. an arxiv PDF first-page render), it fills the
// page; otherwise we draw a stylized title + content lines.
const PagePreview = ({
  item,
  domain,
  previewImageUrl,
}: {
  item: Item;
  domain: string | null;
  previewImageUrl: string | null;
}) => {
  const title = item.title?.trim() || domain || "Untitled";
  return (
    <div className="absolute inset-0 bg-muted">
      {/* The mini page — narrower than the container, anchored to the bottom
          and extending past it so only the top portion is visible. */}
      <div className="absolute inset-x-3 top-3 bottom-[-30%] overflow-hidden rounded-t-[3px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.18)] dark:bg-zinc-100">
        {previewImageUrl ? (
          <Image
            src={previewImageUrl}
            alt=""
            fill
            sizes="128px"
            className="object-cover object-top"
            unoptimized
          />
        ) : (
          <div className="flex flex-col gap-0.75 px-1.5 pt-1.5">
            <div className="line-clamp-2 text-[6px] leading-[1.2] font-semibold text-zinc-900">
              {title}
            </div>
            <div className="mt-0.5 h-0.5 w-full rounded-full bg-zinc-300" />
            <div className="h-0.5 w-[88%] rounded-full bg-zinc-300" />
            <div className="h-0.5 w-[70%] rounded-full bg-zinc-300" />
            <div className="h-0.5 w-[80%] rounded-full bg-zinc-200" />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * The preview thumbnail used by cozy rows and the suggested strip: a YouTube
 * thumbnail when the URL is a video, otherwise the "page" preview (stored PDF
 * first-page render, or a stylized placeholder), with a favicon badge in the
 * corner. Lazily generates + caches a PDF preview the first time a qualifying
 * item is shown. `className` controls size/rounding of the outer box.
 */
export const ItemThumbnail = ({
  item,
  className,
}: {
  item: Item;
  className?: string;
}) => {
  const youtubeThumb = getYouTubeThumb(item);
  const faviconSrc = getFaviconSrc(item);
  const domain = getDomain(item.url);
  const [thumbFailed, setThumbFailed] = React.useState(false);

  // Previews are fetched separately from the items list (they're heavy base64
  // PDF renders). All consumers share the one ["item-previews"] fetch.
  const queryClient = useQueryClient();
  const { data: previews, isSuccess: previewsLoaded } = useQuery({
    queryKey: ["item-previews"],
    queryFn: fetchItemPreviews,
  });
  // Three states, keyed off presence in the previews map:
  //   absent (id not in map) → never attempted; probe once previews loaded.
  //   ""                     → checked, not a PDF; skip.
  //   data URL               → already rendered.
  const previewResolved = previews ? item.id in previews : false;
  const previewImageUrl = previews?.[item.id] || null;

  // Lazy-generate a PDF first-page preview the first time a qualifying item
  // (currently arxiv abs/pdf links + any .pdf URL) is rendered. Result is
  // persisted in the items.preview_image_url column, so this only runs once
  // per item across the whole lifetime of the database.
  const { mutate: triggerGenerate } = useMutation({
    mutationFn: (itemId: string) => generateItemPreview(itemId),
    onSuccess: (dataUrl, itemId) => {
      // Patch the shared previews cache in place rather than refetching the
      // whole (heavy) bulk payload. null from the action means "not a PDF".
      queryClient.setQueryData<Record<string, string>>(
        ["item-previews"],
        (old) => ({ ...(old ?? {}), [itemId]: dataUrl ?? "" }),
      );
    },
    onSettled: (_d, _e, itemId) => inFlight.delete(itemId),
  });
  React.useEffect(() => {
    if (!previewsLoaded) return; // wait until we know which are resolved
    if (previewResolved) return;
    if (youtubeThumb) return;
    if (!isProbeableUrl(item.url)) return;
    if (inFlight.has(item.id)) return;
    inFlight.add(item.id);
    triggerGenerate(item.id);
  }, [
    item.id,
    item.url,
    previewsLoaded,
    previewResolved,
    youtubeThumb,
    triggerGenerate,
  ]);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted ring-1 ring-foreground/5",
        className,
      )}
    >
      {youtubeThumb && !thumbFailed ? (
        <Image
          src={youtubeThumb}
          alt=""
          fill
          sizes="128px"
          className="object-cover"
          unoptimized
          onError={() => setThumbFailed(true)}
        />
      ) : (
        <PagePreview
          item={item}
          domain={domain}
          previewImageUrl={previewImageUrl}
        />
      )}
      <div className="absolute right-1 bottom-1 flex size-4 items-center justify-center rounded-[3px] bg-background/90 ring-1 ring-foreground/10">
        {faviconSrc ? (
          <Image
            src={faviconSrc}
            alt=""
            width={12}
            height={12}
            className="size-3 rounded-xs"
            unoptimized
          />
        ) : (
          <IconFileFilled className="size-3 text-muted-foreground" />
        )}
      </div>
    </div>
  );
};
