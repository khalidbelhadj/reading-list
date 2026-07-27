import type { Rating } from "@/lib/srs";

// Display order, labels, and keyboard shortcuts for the four SRS ratings —
// shared by the rating footer, the keyboard handler, and the summary bars.
export const RATINGS: Array<{ value: Rating; label: string; key: string }> = [
  { value: "again", label: "Again", key: "1" },
  { value: "hard", label: "Hard", key: "2" },
  { value: "good", label: "Good", key: "3" },
  { value: "easy", label: "Easy", key: "4" },
];
