import Image from "next/image";
import React from "react";
import { IconFileFilled } from "@tabler/icons-react";

import { type Item } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { getFaviconSrc } from "./utils";

const MAX_LINES = 5;

const truncateLines = (text: string) => {
  const lines = text.split("\n");
  if (lines.length <= MAX_LINES) return text;
  return lines.slice(0, MAX_LINES).join("\n");
};

export const ItemPreview = ({ item }: { item: Item }) => {
  const faviconSrc = getFaviconSrc(item);
  const notes = item.notes?.trim() ?? "";
  const truncatedNotes = React.useMemo(() => truncateLines(notes), [notes]);

  return (
    <div className="flex flex-col gap-2">
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
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        </div>
      )}
    </div>
  );
};
