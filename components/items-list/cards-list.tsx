"use client";

import React from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconFileFilled } from "@tabler/icons-react";

import {
  getAllFlashcards,
} from "@/app/actions";
import { fetchItems } from "@/lib/queries";
import { type Item } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FlashcardCard } from "@/components/flashcards/flashcard-card";
import { cn } from "@/lib/utils";
import { parseCardState } from "@/lib/srs";

import { getFaviconSrc } from "./utils";
import { useFlashcardMutations } from "./use-flashcard-mutations";

type AllFlashcard = Awaited<ReturnType<typeof getAllFlashcards>>[number];

export const CardsList = ({
  searchIds,
  onOpenItem,
}: {
  searchIds?: Set<string> | null;
  onOpenItem?: (itemId: string) => void;
}) => {
  const queryClient = useQueryClient();
  const { data: cards = [], isLoading, isError } = useQuery({
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

  const { deletingCardId, handleUpdateCard, handleDeleteCard } = useFlashcardMutations<AllFlashcard>({
    queryKey: ["all-flashcards"],
    onUpdateSuccess: (id) => {
      const card = cards.find((c) => c.id === id);
      if (card?.itemId) {
        queryClient.invalidateQueries({ queryKey: ["flashcards", card.itemId] });
      }
    },
    onDeleteSettled: (id) => {
      const card = cards.find((c) => c.id === id);
      if (card?.itemId) {
        queryClient.invalidateQueries({ queryKey: ["flashcards", card.itemId] });
      }
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });


  const filteredCards = searchIds
    ? cards.filter((c) => searchIds.has(c.id))
    : cards;

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

  if (isError) {
    return (
      <div className="px-1 py-6 text-center text-destructive text-xs">
        Failed to load cards
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

  if (filteredCards.length === 0 && searchIds) {
    return (
      <div className="px-1 py-6 text-center text-muted-foreground text-xs">
        No matching cards
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {filteredCards.map((card) => {
        const item = card.itemId ? itemsById.get(card.itemId) : undefined;
        const favicon = card.itemUrl
          ? getFaviconSrc({
              url: card.itemUrl,
              faviconUrl: card.itemFaviconUrl ?? null,
            })
          : null;
        const footer =
          card.itemTitle && card.itemId ? (
            <ItemFooter
              itemId={card.itemId}
              itemTitle={card.itemTitle}
              favicon={favicon}
              item={item}
              onOpenItem={onOpenItem}
            />
          ) : null;
        return (
          <FlashcardCard
            key={card.id}
            card={card}
            onUpdate={handleUpdateCard}
            onDelete={handleDeleteCard}
            deleting={deletingCardId === card.id}
            footer={footer}
          />
        );
      })}
    </div>
  );
};

const ItemFooter = ({
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
}) => {
  const handleClick = React.useCallback(() => {
    onOpenItem?.(itemId);
  }, [itemId, onOpenItem]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mt-1 -mx-1 p-1 rounded-md flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:bg-accent hover:text-muted-foreground transition-colors min-w-0 w-[calc(100%+0.5rem)]"
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
};

const STATE_SEGMENTS: Array<{
  key: "new" | "learning" | "review" | "relearning";
  label: string;
  className: string;
  barClassName: string;
}> = [
  {
    key: "new",
    label: "New",
    className:
      "text-[oklch(0.55_0.06_250)] dark:text-[oklch(0.72_0.08_250)]",
    barClassName:
      "bg-[oklch(0.82_0.05_250)] dark:bg-[oklch(0.6_0.08_250)]",
  },
  {
    key: "learning",
    label: "Learning",
    className:
      "text-[oklch(0.55_0.09_80)] dark:text-[oklch(0.78_0.1_80)]",
    barClassName:
      "bg-[oklch(0.85_0.08_80)] dark:bg-[oklch(0.65_0.1_80)]",
  },
  {
    key: "review",
    label: "Review",
    className:
      "text-[oklch(0.55_0.06_150)] dark:text-[oklch(0.72_0.08_150)]",
    barClassName:
      "bg-[oklch(0.82_0.05_150)] dark:bg-[oklch(0.6_0.08_150)]",
  },
  {
    key: "relearning",
    label: "Relearning",
    className:
      "text-[oklch(0.55_0.1_25)] dark:text-[oklch(0.72_0.1_25)]",
    barClassName:
      "bg-[oklch(0.82_0.09_25)] dark:bg-[oklch(0.6_0.1_25)]",
  },
];

export const CardsStateBar = () => {
  const { data: cards = [] } = useQuery({
    queryKey: ["all-flashcards"],
    queryFn: getAllFlashcards,
  });

  const counts = React.useMemo(() => {
    const c = { new: 0, learning: 0, review: 0, relearning: 0, due: 0 };
    const now = Date.now();
    for (const card of cards) {
      const s = parseCardState(card.state);
      if (s in c) c[s]++;
      if (card.due && new Date(card.due).getTime() <= now) c.due++;
    }
    return c;
  }, [cards]);

  if (cards.length === 0) return null;
  const total = cards.length;

  return (
    <div className="flex flex-col gap-1.5 px-1 pb-1">
      <div className="flex h-1.5 rounded-full bg-muted overflow-hidden">
        {STATE_SEGMENTS.map((s) => {
          const pct = total > 0 ? (counts[s.key] / total) * 100 : 0;
          return pct > 0 ? (
            <div
              key={s.key}
              className={cn("h-full", s.barClassName)}
              style={{ width: `${pct}%` }}
            />
          ) : null;
        })}
      </div>
      <div className="flex items-center gap-3 text-[0.6875rem]">
        {STATE_SEGMENTS.map((s) => (
          <span key={s.key} className={cn("tabular-nums", s.className)}>
            {counts[s.key]} {s.label}
          </span>
        ))}
        {counts.due > 0 && (
          <span className="ml-auto text-muted-foreground tabular-nums">
            {counts.due} due
          </span>
        )}
      </div>
    </div>
  );
};
