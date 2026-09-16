// Fixtures for the Mac app's ports of TypeScript logic. Each helper that was
// ported rather than shared (the scheduler, the review order, the notes
// rewrite, date groups, relative time, YouTube ids, item order) is run here
// over a fixed set of inputs; `swift test` replays the same inputs through
// the Swift version and compares. A port that drifts fails the check.
//
//   bun run gen:fixtures          write mac/Tests/ReadingListTests/Fixtures/*.json
//   bun run gen:fixtures --check  fail when they are stale
//
// Runs under TZ=UTC (package.json), since date grouping uses local time.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { interleaveByItem } from "@/components/shell/review-order";
import { replaceCardInNotes } from "@/lib/card-parse";
import { groupByDate } from "@/lib/date-groups";
import { timeAgo } from "@/lib/format-time";
import { compareItems } from "@/lib/item-sort";
import { type Rating, schedule, type SrsState } from "@/lib/srs";
import { type Item } from "@/lib/types";
import { getYouTubeVideoId } from "@/lib/url";

import { repoRoot } from "./profiles";

const OUT = join(repoRoot, "mac", "Tests", "ReadingListTests", "Fixtures");
const NOW = "2026-09-13T10:00:00.000Z";

const fixtures: Record<string, unknown> = {};

// --- the scheduler ---
const states: SrsState[] = [
  { state: "new", interval: 0, easeFactor: 2.5, reps: 0, lapses: 0, due: NOW },
  {
    state: "learning",
    interval: 0,
    easeFactor: 2.5,
    reps: 0,
    lapses: 0,
    due: NOW,
  },
  {
    state: "relearning",
    interval: 6,
    easeFactor: 2.1,
    reps: 4,
    lapses: 1,
    due: NOW,
  },
  {
    state: "review",
    interval: 6,
    easeFactor: 2.5,
    reps: 3,
    lapses: 0,
    due: NOW,
  },
  {
    state: "review",
    interval: 1,
    easeFactor: 1.3,
    reps: 1,
    lapses: 2,
    due: NOW,
  },
  {
    state: "review",
    interval: 21,
    easeFactor: 2.8,
    reps: 7,
    lapses: 0,
    due: NOW,
  },
];
const ratings: Rating[] = ["again", "hard", "good", "easy"];
fixtures["srs"] = states.flatMap((prev) =>
  ratings.map((rating) => ({
    prev,
    rating,
    next: schedule(prev, rating, NOW),
  })),
);

// --- the review order ---
const cards = [
  { id: "a1", itemId: "a", due: "2026-09-01T00:00:00.000Z" },
  { id: "a2", itemId: "a", due: "2026-09-02T00:00:00.000Z" },
  { id: "a3", itemId: "a", due: "2026-09-03T00:00:00.000Z" },
  { id: "b1", itemId: "b", due: "2026-09-04T00:00:00.000Z" },
  { id: "o", itemId: null, due: "2026-09-05T00:00:00.000Z" },
  { id: "c1", itemId: "c", due: "2026-08-30T00:00:00.000Z" },
  { id: "b2", itemId: "b", due: "2026-09-06T00:00:00.000Z" },
];
fixtures["review-order"] = {
  cards,
  order: interleaveByItem(cards).map((card) => card.id),
};

// --- the notes rewrite ---
const notes = [
  "Some notes.",
  "",
  '<card id="abc">',
  "<front>",
  "Old front",
  "</front>",
  "<back>",
  "Old back",
  "</back>",
  "</card>",
  "",
  "```",
  '<card id="abc">',
  "</card>",
  "```",
  "",
  '<card id="def">',
  "<front>",
  "Other",
  "</front>",
  "<back>",
  "Card",
  "</back>",
  "</card>",
].join("\n");
fixtures["card-notes"] = [
  { notes, id: "def", front: "New front", back: "New\nback" },
  { notes, id: "abc", front: "F", back: "B" },
  { notes, id: "abc", front: "</card>", back: "ok" },
  { notes, id: "nope", front: "", back: "" },
].map((input) => ({
  ...input,
  result: replaceCardInNotes(input.notes, input.id, input.front, input.back),
}));

// --- date groups ---
const dates = [
  "2026-09-13T08:00:00.000Z",
  "2026-09-12T23:30:00.000Z",
  "2026-09-11T12:00:00.000Z",
  "2026-09-07T12:00:00.000Z",
  "2026-09-06T12:00:00.000Z",
  "2026-09-01T00:00:00.000Z",
  "2026-08-31T23:59:00.000Z",
  "2026-07-15T12:00:00.000Z",
  "2025-12-31T12:00:00.000Z",
];
fixtures["date-groups"] = {
  now: NOW,
  groups: groupByDate(dates, (date) => date, new Date(NOW)).map(
    ({ group, entries }) => ({
      key: group.key,
      label: group.label,
      entries,
    }),
  ),
};

// --- relative time ---
const ages = [
  0,
  30_000,
  60_000,
  59 * 60_000,
  60 * 60_000,
  23 * 3_600_000,
  24 * 3_600_000,
  6 * 86_400_000,
  29 * 86_400_000,
  30 * 86_400_000,
  364 * 86_400_000,
  365 * 86_400_000,
  800 * 86_400_000,
];
fixtures["time-ago"] = ages.map((ms) => {
  const iso = new Date(new Date(NOW).getTime() - ms).toISOString();
  return { iso, now: NOW, label: timeAgo(iso, NOW) };
});

// --- YouTube ids ---
const urls = [
  "https://www.youtube.com/watch?v=x1npPrzyKfs",
  "https://youtube.com/watch?v=x1npPrzyKfs&t=42s",
  "https://m.youtube.com/watch?v=x1npPrzyKfs",
  "https://youtu.be/x1npPrzyKfs",
  "https://youtu.be/x1npPrzyKfs/",
  "https://www.youtube.com/shorts/x1npPrzyKfs",
  "https://www.youtube.com/embed/x1npPrzyKfs/",
  "https://www.youtube.com/live/x1npPrzyKfs",
  "https://www.youtube.com/watch?v=short",
  "https://example.com/watch?v=x1npPrzyKfs",
  "not a url",
  "",
];
fixtures["youtube"] = urls.map((url) => ({ url, id: getYouTubeVideoId(url) }));

// --- item order ---
const item = (
  id: string,
  title: string,
  createdAt: string,
  updatedAt = createdAt,
): Item => ({
  id,
  userId: "u",
  title,
  url: "",
  faviconUrl: null,
  starred: false,
  notes: null,
  read: false,
  readAt: null,
  hiddenFromReview: false,
  createdAt,
  updatedAt,
  flashcardCount: 0,
});
const items = [
  item("3", "beta", "2026-09-01T00:00:00.000Z", "2026-09-05T00:00:00.000Z"),
  item("1", "Alpha", "2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z"),
  item("2", "alpha", "2026-09-01T00:00:00.000Z", "2026-09-03T00:00:00.000Z"),
  item("4", "Gamma", "2026-09-03T00:00:00.000Z"),
  item("5", "delta", "2026-08-30T00:00:00.000Z", "2026-09-10T00:00:00.000Z"),
];
fixtures["item-sort"] = {
  items,
  createdDesc: [...items]
    .sort((a, b) => compareItems(a, b))
    .map((entry) => entry.id),
  createdAsc: [...items]
    .sort((a, b) => compareItems(a, b, "createdAt", 1))
    .map((entry) => entry.id),
  updatedDesc: [...items]
    .sort((a, b) => compareItems(a, b, "updatedAt"))
    .map((entry) => entry.id),
};

mkdirSync(OUT, { recursive: true });
const check = process.argv.includes("--check");
let stale = false;
for (const [name, value] of Object.entries(fixtures)) {
  const file = join(OUT, `${name}.json`);
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const current = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (current === text) continue;
  if (check) {
    stale = true;
    console.error(`${file} is stale; run \`bun run gen:fixtures\``);
    continue;
  }
  writeFileSync(file, text);
  console.log(`wrote ${file}`);
}
if (stale) process.exit(1);
