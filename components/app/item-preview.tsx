import { timeAgo } from "@/lib/format-time";

import { ItemThumbnail } from "./item-thumbnail";

// What a hovered item shows: the preview thumbnail (YouTube frame, PDF page,
// or the stylized placeholder — favicon badge included), the full title, and
// when it was added. Meant for the HoverCard beside a sidebar row; the
// caller resolves `previewImageUrl` (see use-item-preview in the shell).
export const ItemPreview = ({
  item,
  previewImageUrl,
  nowIso,
}: {
  item: {
    title: string;
    url: string;
    faviconUrl?: string | null;
    createdAt: string;
  };
  previewImageUrl: string | null;
  nowIso: string;
}) => (
  <div className="flex w-[23.5rem] max-w-full items-center gap-3">
    <ItemThumbnail
      item={item}
      previewImageUrl={previewImageUrl}
      className="aspect-video w-32 shrink-0 rounded-[3px]"
    />
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <p className="line-clamp-2 font-content text-body leading-snug">
        {item.title || "Untitled"}
      </p>
      <p className="text-small text-muted-foreground">
        Added {timeAgo(item.createdAt, nowIso)}
      </p>
    </div>
  </div>
);
