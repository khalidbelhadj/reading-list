import type { SessionSummary } from "@/app/actions";
import { SessionSummaryView } from "@/components/review/session-summary";

// Dev-only route to iterate on the session summary screen without having to
// complete a real review. Match a row pattern by tweaking the stub below.

const STUB: SessionSummary = {
  mode: "due",
  scope: null,
  totalCards: 12,
  ratedCards: 12,
  ratings: { again: 1, hard: 2, good: 6, easy: 3 },
  totalActiveMs: 4 * 60 * 1000 + 17_000,
  wallClockMs: 5 * 60 * 1000 + 42_000,
  avgTimeToRevealMs: 6_400,
};

const ReviewSummaryPreview = () => {
  return (
    <SessionSummaryView
      sessionId="preview"
      cardCount={STUB.totalCards}
      mockSummary={STUB}
    />
  );
};

export default ReviewSummaryPreview;
