import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { getAllFlashcards } from "@/app/actions";
import { Flashcard } from "@/components/app/flashcard";
import { TextLink } from "@/components/system/link";
import { Skeleton } from "@/components/system/skeleton";

import { useEditFlashcard } from "./use-edit-flashcard";

// The deck: every card, grouped by item, answers shown, editable in place
// (click into the text). The quiet layer behind the session.
export const Deck = ({ onBack }: { onBack: () => void }) => {
  const queryClient = useQueryClient();
  const { data: cards } = useQuery({
    queryKey: ["all-flashcards"],
    queryFn: getAllFlashcards,
  });
  const saveFlashcard = useEditFlashcard();

  const deckDirtyRef = React.useRef(new Set<string>());
  const patchDeckCard = React.useCallback(
    (id: string, fields: { front?: string; back?: string }) => {
      deckDirtyRef.current.add(id);
      queryClient.setQueryData<NonNullable<typeof cards>>(
        ["all-flashcards"],
        (old) =>
          old?.map((cached) =>
            cached.id === id ? { ...cached, ...fields } : cached,
          ),
      );
    },
    [queryClient],
  );

  const commitDeckCard = React.useCallback(
    (id: string) => {
      if (!deckDirtyRef.current.delete(id)) return;
      const current = queryClient
        .getQueryData<NonNullable<typeof cards>>(["all-flashcards"])
        ?.find((cached) => cached.id === id);
      if (current) saveFlashcard(current);
    },
    [queryClient, saveFlashcard],
  );

  const groups = React.useMemo(() => {
    const byItem = new Map<
      string,
      { title: string; cards: NonNullable<typeof cards> }
    >();
    for (const flashcard of cards ?? []) {
      const key = flashcard.itemId ?? "";
      const group = byItem.get(key) ?? {
        title: flashcard.itemTitle || "No item",
        cards: [],
      };
      group.cards.push(flashcard);
      byItem.set(key, group);
    }
    // Keyed by itemId, not title — two items can share a title.
    return [...byItem.entries()].map(([itemId, group]) => ({
      itemId,
      ...group,
    }));
  }, [cards]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-8 pt-12 pb-16">
      <div className="flex items-baseline justify-between">
        <p className="text-small text-muted-foreground">
          {cards ? `${cards.length} cards` : "Cards"}
        </p>
        <TextLink
          variant="quiet"
          href="#"
          className="text-micro font-medium"
          onClick={(event) => {
            event.preventDefault();
            onBack();
          }}
        >
          Back to review
        </TextLink>
      </div>
      {cards ? (
        groups.map((group) => (
          <section key={group.itemId} className="flex flex-col gap-1.5">
            <h2 className="px-2 text-micro font-medium text-muted-foreground">
              {group.title}
            </h2>
            <div className="flex flex-col gap-1.5">
              {group.cards.map((flashcard) => (
                <Flashcard
                  key={flashcard.id}
                  front={flashcard.front}
                  back={flashcard.back}
                  revealed
                  onFrontChange={(front) =>
                    patchDeckCard(flashcard.id, { front })
                  }
                  onBackChange={(back) => patchDeckCard(flashcard.id, { back })}
                  onCommit={() => commitDeckCard(flashcard.id)}
                />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 6 }, (_, skeletonIndex) => (
            <Skeleton key={skeletonIndex} className="h-16 w-full" />
          ))}
        </div>
      )}
    </div>
  );
};
