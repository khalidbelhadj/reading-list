import React from "react";

import { type Item } from "@/lib/types";

const DAY_MS = 1000 * 60 * 60 * 24;

// v0 "Suggested next reads": rank unread items using only signals already
// stored on each item (no embeddings, no new tracking). The score is a weighted
// sum of a few heuristics, tuned so recency leads but a long-ignored backlog and
// your demonstrated tag taste also get a say.
const WEIGHTS = {
  recency: 1.0, // freshly saved — you saved it for a reason
  aging: 0.6, // saved long ago and still unread — resurface the backlog
  starred: 0.8, // explicit "I care about this"
  notes: 0.3, // you wrote something → invested
  tagAffinity: 0.7, // shares tags with what you read/star
};

// Recently saved decays over ~2 weeks; old items contribute ~0.
const recencyScore = (ageDays: number) => Math.exp(-ageDays / 14);

// Backlog resurfacer: nothing for the first month, then ramps up to 1 over the
// following two months so genuinely-ignored items climb back into view.
const agingScore = (ageDays: number) =>
  ageDays <= 30 ? 0 : Math.min((ageDays - 30) / 60, 1);

// Tag taste: how often each tag appears on items you've read or starred,
// normalised to [0, 1] against the most-engaged tag.
const buildTagAffinity = (items: Item[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.read && !item.starred) continue;
    for (const tag of item.tags) {
      counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1);
    }
  }
  let max = 0;
  for (const count of counts.values()) max = Math.max(max, count);
  if (max === 0) return counts;
  const affinity = new Map<string, number>();
  for (const [name, count] of counts) affinity.set(name, count / max);
  return affinity;
};

const scoreItem = (
  item: Item,
  now: number,
  tagAffinity: Map<string, number>,
): number => {
  const ageDays = (now - new Date(item.createdAt).getTime()) / DAY_MS;
  const tagScore = item.tags.length
    ? Math.max(...item.tags.map((tag) => tagAffinity.get(tag.name) ?? 0))
    : 0;
  return (
    WEIGHTS.recency * recencyScore(ageDays) +
    WEIGHTS.aging * agingScore(ageDays) +
    WEIGHTS.starred * (item.starred ? 1 : 0) +
    WEIGHTS.notes * (item.notes?.trim() ? 1 : 0) +
    WEIGHTS.tagAffinity * tagScore
  );
};

// Greedy top-N with a light diversity cap: no single tag may claim more than
// `maxPerTag` slots, so one dominant topic can't fill the whole strip. Items
// that would breach the cap are held back and used only to top up if needed.
const pickDiverse = (
  ranked: Item[],
  limit: number,
  maxPerTag: number,
): Item[] => {
  const picked: Item[] = [];
  const held: Item[] = [];
  const tagCounts = new Map<string, number>();
  for (const item of ranked) {
    if (picked.length >= limit) break;
    const overCap = item.tags.some(
      (tag) => (tagCounts.get(tag.name) ?? 0) >= maxPerTag,
    );
    if (overCap) {
      held.push(item);
      continue;
    }
    picked.push(item);
    for (const tag of item.tags) {
      tagCounts.set(tag.name, (tagCounts.get(tag.name) ?? 0) + 1);
    }
  }
  for (const item of held) {
    if (picked.length >= limit) break;
    picked.push(item);
  }
  return picked;
};

/**
 * Top suggested unread items for the "Suggested" strip above the list.
 *
 * Returns `[]` when there aren't meaningfully more unread items than the limit —
 * if you can already see them all, a suggestion strip is just noise.
 */
export const useSuggestions = (
  items: Item[] | undefined,
  limit = 20,
): Item[] => {
  return React.useMemo(() => {
    if (!items) return [];
    const unread = items.filter((item) => !item.read);
    if (unread.length <= limit) return [];

    const now = Date.now();
    const tagAffinity = buildTagAffinity(items);
    const ranked = unread
      .map((item) => ({ item, score: scoreItem(item, now, tagAffinity) }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);

    return pickDiverse(ranked, limit, 2);
  }, [items, limit]);
};
