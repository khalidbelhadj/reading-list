"use client";

import React from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconFileFilled } from "@tabler/icons-react";

import {
  deleteFlashcard,
  getAllFlashcards,
  updateFlashcard,
} from "@/app/actions";
import { fetchItems } from "@/lib/queries";
import { type Item } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FlashcardCard } from "@/components/flashcards/flashcard-card";

import { getFaviconSrc } from "./utils";

type AllFlashcard = Awaited<ReturnType<typeof getAllFlashcards>>[number];

export const CardsList = ({
  onOpenItem,
}: {
  onOpenItem?: (itemId: string) => void;
}) => {
  const queryClient = useQueryClient();
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

  const [deletingCardId, setDeletingCardId] = React.useState<string | null>(
    null,
  );

  const updateCardMutation = useMutation({
    mutationFn: ({
      id,
      front,
      back,
    }: {
      id: string;
      front?: string;
      back?: string;
    }) => updateFlashcard(id, { front, back }),
    onMutate: async ({ id, front, back }) => {
      await queryClient.cancelQueries({ queryKey: ["all-flashcards"] });
      const previous = queryClient.getQueryData(["all-flashcards"]);
      queryClient.setQueryData<AllFlashcard[]>(["all-flashcards"], (old) =>
        (old ?? []).map((c) =>
          c.id === id
            ? {
                ...c,
                ...(front !== undefined && { front }),
                ...(back !== undefined && { back }),
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["all-flashcards"], context.previous);
      }
    },
    onSuccess: (_data, vars) => {
      const card = cards.find((c) => c.id === vars.id);
      if (card?.itemId) {
        queryClient.invalidateQueries({
          queryKey: ["flashcards", card.itemId],
        });
      }
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => deleteFlashcard(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["all-flashcards"] });
      const previous = queryClient.getQueryData(["all-flashcards"]);
      queryClient.setQueryData<AllFlashcard[]>(["all-flashcards"], (old) =>
        (old ?? []).filter((c) => c.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["all-flashcards"], context.previous);
      }
    },
    onSettled: (_data, _err, id) => {
      const card = cards.find((c) => c.id === id);
      if (card?.itemId) {
        queryClient.invalidateQueries({
          queryKey: ["flashcards", card.itemId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["flashcard-counts"] });
    },
  });

  const handleUpdateCard = React.useCallback(
    (id: string, fields: { front?: string; back?: string }) => {
      updateCardMutation.mutate({ id, ...fields });
    },
    [updateCardMutation],
  );

  const handleDeleteCard = React.useCallback(
    async (cardId: string) => {
      setDeletingCardId(cardId);
      try {
        await deleteCardMutation.mutateAsync(cardId);
      } finally {
        setDeletingCardId(null);
      }
    },
    [deleteCardMutation],
  );

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
