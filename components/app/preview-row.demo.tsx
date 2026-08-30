import { IconStarFilled } from "@tabler/icons-react";

import { type Demo } from "@/components/system/demo";

import { ItemThumbnail } from "./item-thumbnail";
import { PreviewRow } from "./preview-row";

const ROWS = [
  {
    title: "FoundationDB: A Distributed Unbundled Transactional KeyValue Store",
    url: "https://foundationdb.org",
    meta: "Added 2 days ago",
    starred: true,
  },
  {
    title: "Multicast and the Markets with Brian Nigito",
    url: "https://youtube.com",
    meta: "Added 1 week ago",
    starred: false,
  },
  {
    title: "Sequential consistency",
    url: "https://en.wikipedia.org/wiki/Sequential_consistency",
    meta: "Added 3 weeks ago",
    starred: false,
  },
] as const;

export const demo: Demo = {
  title: "Preview row",
  description:
    "ListRow's roomier sibling for the cozy list density: title with a quiet meta line beneath, same hover and selected registers.",
  render: () => (
    <div className="flex w-96 flex-col gap-0.5">
      {ROWS.map((row, index) => (
        <PreviewRow
          key={row.title}
          leading={
            <ItemThumbnail
              item={{ url: row.url, title: row.title }}
              previewImageUrl={null}
              className="aspect-video w-24 rounded-[3px]"
            />
          }
          title={row.title}
          meta={row.meta}
          selected={index === 0}
          trailing={
            row.starred ? (
              <IconStarFilled className="size-3 shrink-0 text-starred" />
            ) : undefined
          }
        />
      ))}
    </div>
  ),
};
