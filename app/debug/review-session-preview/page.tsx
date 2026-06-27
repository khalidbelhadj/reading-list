"use client";

import { notFound } from "next/navigation";

import { ReviewSession } from "@/app/review/[sessionId]/review-session";
import type { ReviewSessionCard, ReviewSessionData } from "@/app/actions";

// Dev-only route to drive the full interactive review flow (reveal → rate →
// next → summary) without a database. ReviewSession runs entirely in-memory
// when given `previewData`: every server action is a no-op and the summary is
// built from the ratings you click. Tweak STUB_CARDS below to try edge cases.

const card = (
  overrides: Partial<ReviewSessionCard> &
    Pick<ReviewSessionCard, "id" | "front" | "back">,
): ReviewSessionCard => ({
  itemId: "item-1",
  state: "review",
  // A fixed past date — these cards read as "due". The exact value only feeds
  // the SRS interval preview on the rating buttons.
  due: "2026-06-01T12:00:00.000Z",
  interval: 4,
  easeFactor: 2.5,
  reps: 3,
  lapses: 0,
  itemTitle: "Designing Data-Intensive Applications",
  itemUrl: "https://dataintensive.net",
  itemFaviconUrl: null,
  ...overrides,
});

const STUB_CARDS: ReviewSessionCard[] = [
  card({
    id: "c1",
    front: "What problem does a **write-ahead log** solve?",
    back: "Durability: changes are appended to an on-disk log *before* being applied, so a crash mid-write can be recovered by replaying the log.",
  }),
  card({
    id: "c2",
    front: "Define **idempotence** in the context of message delivery.",
    back: "An operation is idempotent if applying it multiple times has the same effect as applying it once — letting consumers safely retry without duplicating side effects.",
    state: "learning",
    interval: 0,
    reps: 1,
  }),
  card({
    id: "c3",
    front: "LSM-trees vs. B-trees: which favours **write** throughput?",
    back: "LSM-trees — writes are sequential appends to memtables/SSTables. B-trees write in place and must seek, so they typically favour read latency instead.",
  }),
  card({
    id: "c4",
    front: "What is a **bloom filter** used for in a storage engine?",
    back: "A probabilistic set membership test that lets the engine skip SSTables that definitely don't contain a key — no false negatives, occasional false positives.",
    // A card with no parent item exercises the title-less header branch.
    itemId: null,
    itemTitle: null,
    itemUrl: null,
    state: "new",
    interval: 0,
    reps: 0,
  }),
  card({
    id: "c5",
    front: "Why does **two-phase commit** block on coordinator failure?",
    back: "Participants that voted to commit must hold locks and wait for the coordinator's decision; if it crashes after the prepare phase, they cannot unilaterally resolve.",
    itemId: "item-2",
    itemTitle: "Notes on distributed transactions",
    itemUrl: "https://example.com/2pc",
    interval: 21,
    reps: 6,
  }),
];

const STUB: ReviewSessionData = {
  session: {
    id: "preview",
    mode: "due",
    cardsPlanned: STUB_CARDS.length,
    cardsCompleted: 0,
    affectsSchedule: true,
    startedAt: "2026-06-27T12:00:00.000Z",
    endedAt: null,
  },
  cards: STUB_CARDS,
  completedCardIds: [],
};

const ReviewSessionPreview = () => {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <ReviewSession sessionId="preview" previewData={STUB} />;
};

export default ReviewSessionPreview;
