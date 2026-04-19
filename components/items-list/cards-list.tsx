"use client";

import React from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { IconFileFilled } from "@tabler/icons-react";

import { getAllFlashcards } from "@/app/actions";
import { fetchItems } from "@/lib/queries";
import { type Item } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Skeleton } from "@/components/ui/skeleton";

import { getFaviconSrc } from "./utils";

export const CardsList = ({
  onOpenItem,
}: {
  onOpenItem?: (itemId: string) => void;
}) => {
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["all-flashcards"],
    queryFn: getAllFlashcards,
  });
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  const itemsById = React.useMemo(() => {
    const map = new Map<string, Item>();
    items?.forEach((it) => map.set(it.id, it));
    return map;
  }, [items]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ opacity: Math.max(1 - i * 0.2, 0.2) }}>
            <Skeleton className="h-22 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="px-1 py-6 text-center text-muted-foreground text-xs">
        No cards yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {cards.map((card) => {
        const item = card.itemId ? itemsById.get(card.itemId) : undefined;
        const favicon = card.itemUrl
          ? getFaviconSrc({
              url: card.itemUrl,
              faviconUrl: card.itemFaviconUrl ?? null,
            })
          : null;
        return (
          <div
            key={card.id}
            className="font-content rounded-lg bg-card px-4 py-3 flex flex-col gap-0.5"
          >
            <MarkdownEditor
              value={card.front}
              editable={false}
              className="text-sm"
            />
            <MarkdownEditor
              value={card.back}
              editable={false}
              className="text-sm text-muted-foreground"
            />
            {card.itemTitle && card.itemId && (
              <CardButton
                itemId={card.itemId}
                itemTitle={card.itemTitle}
                favicon={favicon}
                item={item}
                onOpenItem={onOpenItem}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

function CardButton({
  itemId,
  itemTitle,
  favicon,
  item,
  onOpenItem,
}: {
  itemId: string;
  itemTitle: string;
  favicon: string | null;
  item: Item | undefined;
  onOpenItem?: (itemId: string) => void;
}) {
  const handleClick = React.useCallback(() => {
    onOpenItem?.(itemId);
  }, [itemId, onOpenItem]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mt-0.5 -mx-1 p-1 rounded-md flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:bg-accent hover:text-muted-foreground transition-colors min-w-0"
    >
      {favicon ? (
        <Image
          src={favicon}
          alt=""
          width={14}
          height={14}
          className="size-3.5 rounded-[3px] shrink-0"
          unoptimized
        />
      ) : (
        <IconFileFilled className="size-3.5 shrink-0" />
      )}
      <span className="truncate min-w-0">{itemTitle}</span>
      {item && item.tags.length > 0 && (
        <span className="ml-auto flex items-center gap-1 shrink-0">
          {item.tags.map((t) => (
            <Badge key={t.id} variant="secondary" className="shrink-0">
              {t.name}
            </Badge>
          ))}
        </span>
      )}
    </button>
  );
}
