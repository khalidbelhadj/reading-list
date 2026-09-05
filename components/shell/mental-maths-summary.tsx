import React from "react";

import {
  RunTimeline,
  ThinkingTimeHistogram,
} from "@/components/app/maths-run-charts";
import { Button } from "@/components/system/button";
import { Kbd } from "@/components/system/kbd";
import {
  type Attempt,
  formatProblem,
  formatSeconds,
  OPERATION_LABEL,
  summarizeRun,
} from "@/lib/mental-maths";

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="font-content text-display font-medium tabular-nums">
      {value}
    </span>
    <span className="text-small text-muted-foreground">{label}</span>
  </div>
);

// The overview after the clock: headline numbers, a row per operation, and
// every miss with its answer. Enter runs it again with the same settings.
export const MentalMathsSummary = ({
  attempts,
  endedEarly,
  onAgain,
  onChangeSettings,
}: {
  attempts: Attempt[];
  endedEarly: boolean;
  onAgain: () => void;
  onChangeSettings: () => void;
}) => {
  const summary = React.useMemo(() => summarizeRun(attempts), [attempts]);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      onAgain();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onAgain]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-content text-heading font-medium">
          {endedEarly ? "Ended early" : "Time\u2019s up"}
        </h2>
        <p className="text-body text-muted-foreground">
          {summary.attempts === 0
            ? "Nothing answered this time."
            : `${summary.correct} of ${summary.attempts} correct.`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Stat label="Solved" value={String(summary.correct)} />
        <Stat
          label="Accuracy"
          value={`${Math.round(summary.accuracy * 100)}%`}
        />
        <Stat
          label="Thinking time"
          value={summary.attempts ? formatSeconds(summary.averageMs) : "–"}
        />
      </div>

      {summary.attempts > 0 && (
        <div className="grid grid-cols-2 gap-8">
          <div className="flex flex-col gap-2">
            <span className="text-small font-medium text-muted-foreground select-none">
              Thinking time
            </span>
            <ThinkingTimeHistogram attempts={attempts} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-small font-medium text-muted-foreground select-none">
              In order
            </span>
            <RunTimeline attempts={attempts} />
          </div>
        </div>
      )}

      {summary.byOperation.length > 0 && (
        <div className="flex flex-col">
          {summary.byOperation.map((row) => (
            <div
              key={row.operation}
              className="flex h-row items-center gap-4 text-body"
            >
              <span className="flex-1">{OPERATION_LABEL[row.operation]}</span>
              <span className="w-16 text-right text-muted-foreground tabular-nums">
                {row.correct}/{row.attempts}
              </span>
              <span className="w-16 text-right text-muted-foreground tabular-nums">
                {formatSeconds(row.averageMs)}
              </span>
            </div>
          ))}
        </div>
      )}

      {summary.misses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-small font-medium text-muted-foreground select-none">
            Missed
          </span>
          <div className="flex flex-col">
            {summary.misses.map((attempt, index) => (
              <div
                key={index}
                className="flex h-row items-center gap-4 font-content text-body tabular-nums"
              >
                <span className="flex-1">{formatProblem(attempt.problem)}</span>
                <span className="text-muted-foreground">
                  {attempt.problem.answer}
                </span>
                <span className="w-16 text-right text-small text-muted-foreground">
                  {formatSeconds(attempt.ms)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={onAgain}>
          Again
          <Kbd variant="on-primary" className="ml-0.5">
            ↵
          </Kbd>
        </Button>
        <Button variant="ghost" onClick={onChangeSettings}>
          Change settings
        </Button>
      </div>
    </div>
  );
};
