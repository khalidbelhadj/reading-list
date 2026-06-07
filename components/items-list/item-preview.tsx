import Image from "next/image";
import React from "react";
import { IconFileFilled } from "@tabler/icons-react";

import { type Item } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { getYouTubeVideoId } from "@/lib/url";
import { getFaviconSrc } from "./utils";

const MAX_LINES = 5;

// Truncate by line count, but never cut inside a `<card>…</card>` block — a
// half-included card has no closing tag, so the markdown parser can't match it
// and renders the raw tags as broken text. Once the line budget is spent while
// inside a card, keep going until the block closes, then stop.
const truncateLines = (text: string) => {
  const lines = text.split("\n");
  if (lines.length <= MAX_LINES) return { text, truncated: false };

  const kept: string[] = [];
  let insideCard = false;
  for (const line of lines) {
    if (kept.length >= MAX_LINES && !insideCard) break;
    if (/^<card\b/i.test(line.trim())) insideCard = true;
    kept.push(line);
    if (insideCard && /<\/card>/i.test(line)) insideCard = false;
  }

  if (kept.length === lines.length) return { text, truncated: false };
  return { text: kept.join("\n"), truncated: true };
};

const formatCreatedAt = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const ItemPreview = ({ item }: { item: Item }) => {
  const faviconSrc = getFaviconSrc(item);
  const youtubeId = item.url ? getYouTubeVideoId(item.url) : null;
  const notes = item.notes?.trim() ?? "";
  const { text: truncatedNotes, truncated } = React.useMemo(
    () => truncateLines(notes),
    [notes],
  );

  return (
    <div className="flex flex-col gap-2">
      {youtubeId && (
        <Image
          src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`}
          alt=""
          width={480}
          height={360}
          className="-mx-3 -mt-3 w-[calc(100%+1.5rem)] max-w-none aspect-video object-cover rounded-t-lg"
          unoptimized
        />
      )}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <div className="relative size-4 shrink-0">
            {faviconSrc ? (
              <Image
                src={faviconSrc}
                alt=""
                width={16}
                height={16}
                className="size-4 rounded-[3px]"
                unoptimized
              />
            ) : (
              <IconFileFilled className="size-4 text-muted-foreground" />
            )}
          </div>
          <span className="font-content text-sm font-medium truncate">
            {item.title || "Untitled"}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground/60">
          Created {formatCreatedAt(item.createdAt)}
        </span>
      </div>

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="text-[10px] px-1.5 py-0">
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      {truncatedNotes && (
        <div className="preview-notes relative overflow-hidden text-muted-foreground">
          <MarkdownEditor value={truncatedNotes} editable={false} />
          {truncated && (
            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background dark:from-card to-transparent pointer-events-none" />
          )}
        </div>
      )}
    </div>
  );
};
