import { describe, expect, it } from "bun:test";

import { interleaveByItem } from "./review-order";

const card = (id: string, itemId: string | null, due: string) => ({
  id,
  itemId,
  due,
});

describe("interleaveByItem", () => {
  it("spreads an item's cards apart instead of showing them back to back", () => {
    const queue = interleaveByItem([
      card("a1", "a", "2026-01-01"),
      card("a2", "a", "2026-01-01"),
      card("a3", "a", "2026-01-01"),
      card("b1", "b", "2026-01-02"),
      card("b2", "b", "2026-01-02"),
      card("c1", "c", "2026-01-03"),
    ]);
    expect(queue.map((item) => item.id)).toEqual([
      "a1",
      "b1",
      "c1",
      "a2",
      "b2",
      "a3",
    ]);
  });

  it("ranks items by their most overdue card", () => {
    const queue = interleaveByItem([
      card("b1", "b", "2026-01-05"),
      card("a1", "a", "2026-01-09"),
      card("a2", "a", "2026-01-01"),
    ]);
    expect(queue.map((item) => item.id)).toEqual(["a2", "b1", "a1"]);
  });

  it("treats orphan cards as their own items", () => {
    const queue = interleaveByItem([
      card("a1", "a", "2026-01-01"),
      card("a2", "a", "2026-01-01"),
      card("o1", null, "2026-01-02"),
      card("o2", null, "2026-01-03"),
    ]);
    expect(queue.map((item) => item.id)).toEqual(["a1", "o1", "o2", "a2"]);
  });

  it("keeps every card exactly once", () => {
    const cards = Array.from({ length: 20 }, (_, index) =>
      card(`c${index}`, `item${index % 3}`, `2026-01-${10 + (index % 7)}`),
    );
    const queue = interleaveByItem(cards);
    expect(queue.length).toBe(20);
    expect(new Set(queue.map((item) => item.id)).size).toBe(20);
  });
});
