import { IconDots, IconFileFilled } from "@tabler/icons-react";
import Image from "next/image";
import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { type Item } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getYouTubeVideoId } from "@/lib/url";
import { generateItemPreview } from "@/app/actions";

import { ItemDropdown } from "./item-dropdown";
import { getFaviconSrc } from "./utils";

const getYouTubeThumb = (item: Pick<Item, "url">): string | null => {
  if (!item.url) return null;
  const ytId = getYouTubeVideoId(item.url);
  if (ytId) return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  return null;
};

// Returns true if the item's URL is one we know how to generate a PDF-based
// preview for (arxiv abs/pdf or any direct .pdf link).
const hasPdfPreview = (item: Pick<Item, "url">): boolean => {
  if (!item.url) return false;
  try {
    const url = new URL(item.url);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "arxiv.org" && /^\/(abs|pdf)\//.test(url.pathname)) return true;
    return url.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
};

// Single-flight set so we don't fire duplicate generation requests for the
// same item across re-mounts (e.g. virtualized rows scrolling in and out).
const inFlight = new Set<string>();

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
}: {
  item: Item;
  domain: string | null;
}) => {
  const title = item.title?.trim() || domain || "Untitled";
  return (
    <div className="absolute inset-0 bg-muted">
      {/* The mini page — narrower than the container, anchored to the bottom
          and extending past it so only the top portion is visible. */}
      <div className="absolute inset-x-5 top-3 bottom-[-30%] overflow-hidden rounded-t-[3px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.18)] dark:bg-zinc-100">
        {item.previewImageUrl ? (
          <Image
            src={item.previewImageUrl}
            alt=""
            fill
            sizes="128px"
            className="object-cover object-top"
            unoptimized
          />
        ) : (
          <div className="flex flex-col gap-[3px] px-1.5 pt-1.5">
            <div className="line-clamp-2 text-[6px] font-semibold leading-[1.2] text-zinc-900">
              {title}
            </div>
            <div className="mt-0.5 h-[2px] w-full rounded-full bg-zinc-300" />
            <div className="h-[2px] w-[88%] rounded-full bg-zinc-300" />
            <div className="h-[2px] w-[70%] rounded-full bg-zinc-300" />
            <div className="h-[2px] w-[80%] rounded-full bg-zinc-200" />
          </div>
        )}
      </div>
    </div>
  );
};

export const CozyRowContent = ({
  item,
  isSelected,
  isTyping,
  menuOpen,
  suppressHover,
  onMenuOpenChange,
  onTogglePin,
  onToggleRead,
  onDelete,
}: {
  item: Item;
  isSelected: boolean;
  isTyping?: boolean;
  menuOpen: boolean;
  suppressHover?: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onTogglePin?: () => void;
  onToggleRead?: () => void;
  onDelete?: () => void;
}) => {
  const isRead = item.read;
  const youtubeThumb = getYouTubeThumb(item);
  const faviconSrc = getFaviconSrc(item);
  const domain = getDomain(item.url);
  const [thumbFailed, setThumbFailed] = React.useState(false);

  // Lazy-generate a PDF first-page preview the first time a qualifying item
  // (currently arxiv abs/pdf links + any .pdf URL) is rendered in cozy mode.
  // Result is persisted in the items.preview_image_url column, so this only
  // runs once per item across the whole lifetime of the database.
  const queryClient = useQueryClient();
  const { mutate: triggerGenerate } = useMutation({
    mutationFn: (itemId: string) => generateItemPreview(itemId),
    onSuccess: (dataUrl) => {
      if (dataUrl) queryClient.invalidateQueries({ queryKey: ["items"] });
    },
    onSettled: (_d, _e, itemId) => inFlight.delete(itemId),
  });
  React.useEffect(() => {
    if (item.previewImageUrl) return;
    if (youtubeThumb) return;
    if (!hasPdfPreview({ url: item.url })) return;
    if (inFlight.has(item.id)) return;
    inFlight.add(item.id);
    triggerGenerate(item.id);
  }, [item.id, item.url, item.previewImageUrl, youtubeThumb, triggerGenerate]);

  return (
    <>
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-foreground/5">
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
          <PagePreview item={item} domain={domain} />
        )}
        <div className="absolute bottom-1 right-1 flex size-4 items-center justify-center rounded-[3px] bg-background/90 ring-1 ring-foreground/10">
          {faviconSrc ? (
            <Image
              src={faviconSrc}
              alt=""
              width={12}
              height={12}
              className="size-3 rounded-[2px]"
              unoptimized
            />
          ) : (
            <IconFileFilled className="size-3 text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span
          data-item-title
          className={cn(
            "font-content text-sm/5 fade-r min-w-0",
            !item.title && !isTyping && "text-muted-foreground",
          )}
        >
          <span className="title-strike" data-read={isRead ? "true" : undefined}>
            {item.title || (isTyping ? " " : "Untitled")}
          </span>
        </span>
        {item.url && (
          <span className="fade-r block min-w-0 text-xs text-muted-foreground/60">
            {item.url}
          </span>
        )}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <ItemDropdown
        item={item}
        open={menuOpen}
        onOpenChange={onMenuOpenChange}
        onTogglePin={onTogglePin}
        onToggleRead={onToggleRead}
        onDelete={onDelete}
      >
        <div
          className={cn(
            "absolute top-2 right-2 pointer-events-none invisible group-data-[menu-open]:visible",
            !suppressHover && "group-hover:visible",
          )}
        >
          <DropdownMenuTrigger
            className={cn(
              "pointer-events-auto shrink-0 rounded p-1 text-muted-foreground hover:text-foreground outline-none",
              isSelected && "bg-secondary",
            )}
            onClick={stopPropagation}
            onPointerDown={stopPropagation}
          >
            <IconDots className="size-4" />
          </DropdownMenuTrigger>
        </div>
      </ItemDropdown>
    </>
  );
};

const stopPropagation = (e: React.SyntheticEvent) => {
  e.stopPropagation();
};
