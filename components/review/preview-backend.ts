import React from "react";

import type { ReviewMode, SessionSummary } from "@/app/actions";

import type { ReviewBackend } from "./use-review-flow";

// In-memory ReviewBackend for the dev-only debug preview route: rate/skip/end
// never touch the server, ratings accumulate locally, and the session summary
// is built from those in-memory stats instead of being fetched.
export const usePreviewBackend = ({
  mode,
  totalCards,
}: {
  mode: string;
  totalCards: number;
}): ReviewBackend => {
  // Ending early has no server `endedAt` to read back, so track it locally.
  const [ended, setEnded] = React.useState(false);
  const startRef = React.useRef(performance.now());
  const statsRef = React.useRef({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
    totalActiveMs: 0,
    revealSum: 0,
    revealCount: 0,
  });

  return React.useMemo(
    () => ({
      logEvent: () => {},
      rateCard: async ({ rating, durationMs, timeToRevealMs }) => {
        const stats = statsRef.current;
        stats[rating] += 1;
        stats.totalActiveMs += durationMs;
        if (timeToRevealMs != null) {
          stats.revealSum += timeToRevealMs;
          stats.revealCount += 1;
        }
      },
      onRateSuccess: () => {},
      skipCard: () => {},
      endSession: async (reason) => {
        // "completed" needs no flag — the flow already reads "finished" off
        // the card index once the last card is rated or skipped.
        if (reason === "user_ended") setEnded(true);
      },
      onEndSuccess: () => {},
      ended,
      getSummary: (): SessionSummary => ({
        mode: mode as ReviewMode,
        scope: null,
        totalCards,
        ratedCards:
          statsRef.current.again +
          statsRef.current.hard +
          statsRef.current.good +
          statsRef.current.easy,
        ratings: {
          again: statsRef.current.again,
          hard: statsRef.current.hard,
          good: statsRef.current.good,
          easy: statsRef.current.easy,
        },
        totalActiveMs: statsRef.current.totalActiveMs,
        wallClockMs: Math.round(performance.now() - startRef.current),
        avgTimeToRevealMs: statsRef.current.revealCount
          ? Math.round(
              statsRef.current.revealSum / statsRef.current.revealCount,
            )
          : null,
      }),
    }),
    [ended, mode, totalCards],
  );
};
