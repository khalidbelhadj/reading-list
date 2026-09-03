// Ordering for a review run. Cards from one item are born together and rated
// together, and the scheduler is deterministic, so a plain due-date sort
// shows an item's cards back to back forever. Dealing the queue round-robin
// across items breaks the clumps: each item contributes one card per round,
// which also brings a lone card from a rarely-seen item to the front instead
// of burying it behind a big deck.

type Orderable = { id: string; itemId: string | null; due: string };

// Cards sorted by due date, then interleaved by item: items are ranked by
// their most overdue card, and each round takes the next card from every
// item in that order. Orphan cards each count as their own item.
export const interleaveByItem = <T extends Orderable>(cards: T[]): T[] => {
  const sorted = [...cards].sort((a, b) => a.due.localeCompare(b.due));
  const groups = new Map<string, T[]>();
  for (const card of sorted) {
    const key = card.itemId ?? `card:${card.id}`;
    const group = groups.get(key);
    if (group) group.push(card);
    else groups.set(key, [card]);
  }
  // Map iteration follows first insertion, i.e. each item's earliest due.
  const lanes = [...groups.values()];
  const result: T[] = [];
  for (let round = 0; result.length < sorted.length; round++) {
    for (const lane of lanes) {
      const card = lane[round];
      if (card) result.push(card);
    }
  }
  return result;
};
