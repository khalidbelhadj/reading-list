import { IconSparkles } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { fetchItems, getAllFlashcards } from "@/app/actions";
import {
  ReviewStackCard,
  type ReviewStackSource,
  type ReviewStackStats,
} from "@/components/app/review-stack-card";
import { Button } from "@/components/system/button";
import { Input } from "@/components/system/input";
import { type Item } from "@/lib/types";

import { AskResults } from "./ask-results";
import { buildReviewStack, type QueueCard } from "./review-queues";
import { useAsk } from "./use-ask";
import { dispatchViewCommand, type ReviewStack } from "./view";

// What a rating will do to each card in the stack, and where the cards come
// from: the agent's whole items (listed even with no cards, so the gaps
// show), plus the items behind any individually named cards.
const describeStack = (
  stack: ReviewStack,
  itemIds: string[],
  allCards: QueueCard[],
  items: Item[],
): { stats: ReviewStackStats; sources: ReviewStackSource[] } => {
  const now = new Date().toISOString();
  const wanted = new Set(stack.cardIds);
  const stats: ReviewStackStats = { cards: 0, due: 0, fresh: 0, cram: 0 };
  const countByItem = new Map<string, number>();
  for (const card of allCards) {
    if (!wanted.has(card.id)) continue;
    stats.cards++;
    if (card.state === "new") stats.fresh++;
    else if (card.due <= now) stats.due++;
    else stats.cram++;
    if (card.itemId) {
      countByItem.set(card.itemId, (countByItem.get(card.itemId) ?? 0) + 1);
    }
  }
  const sourceIds = [
    ...itemIds,
    ...[...countByItem.keys()].filter((id) => !itemIds.includes(id)),
  ];
  const byId = new Map(items.map((item) => [item.id, item]));
  const sources: ReviewStackSource[] = [];
  for (const id of sourceIds) {
    const item = byId.get(id);
    if (!item) continue;
    sources.push({
      id,
      title: item.title,
      url: item.url,
      faviconUrl: item.faviconUrl,
      cardCount: countByItem.get(id) ?? 0,
    });
  }
  sources.sort((a, b) => b.cardCount - a.cardCount);
  return { stats, sources };
};

// The Topic composer: describe what you want to review, watch the agent
// search the index, then start the stack it proposes. Lives inside the
// review pane; starting hands the stack back to the pane.
export const ReviewTopic = ({
  onStart,
}: {
  onStart: (stack: ReviewStack) => void;
}) => {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });
  const { data: allCards } = useQuery({
    queryKey: ["all-flashcards"],
    queryFn: getAllFlashcards,
  });
  const [prompt, setPrompt] = React.useState("");
  const ask = useAsk("review");
  const { runAsk } = ask;

  const submit = React.useCallback(() => {
    if (ask.isAsking) return;
    runAsk(prompt);
  }, [ask.isAsking, runAsk, prompt]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    },
    [submit],
  );

  const openItem = React.useCallback(
    (itemId: string) => dispatchViewCommand({ kind: "open-item", itemId }),
    [],
  );

  // The proposed stack resolved against the deck, with its stats and
  // sources for the card below the feed.
  const proposal = React.useMemo(() => {
    if (!ask.review || !allCards || !items) return null;
    const stack = buildReviewStack(
      ask.review.title,
      ask.review.itemIds,
      ask.review.cardIds,
      allCards,
    );
    return {
      stack,
      summary: ask.review.summary,
      ...describeStack(stack, ask.review.itemIds, allCards, items),
    };
  }, [ask.review, allCards, items]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 pt-6">
      <Input
        leading={<IconSparkles />}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What do you want to review?"
        aria-label="Review topic"
        autoFocus
        trailing={
          <Button
            variant="ghost"
            size="sm"
            className="-mr-1.5 px-1.5"
            disabled={ask.isAsking || prompt.trim().length === 0}
            onClick={submit}
          >
            Compile
          </Button>
        }
      />
      {ask.askActive && (
        <AskResults
          steps={ask.steps}
          summary={null}
          // The stack card below lists the sources; no plain rows here.
          resultIds={null}
          isAsking={ask.isAsking}
          hasPresented={false}
          error={ask.error}
          items={items ?? []}
          onOpen={openItem}
        />
      )}
      {proposal && (
        <ReviewStackCard
          title={proposal.stack.title}
          summary={proposal.summary}
          stats={proposal.stats}
          sources={proposal.sources}
          onOpenSource={openItem}
          onStart={
            proposal.stack.cardIds.length > 0
              ? () => onStart(proposal.stack)
              : undefined
          }
        />
      )}
    </div>
  );
};
