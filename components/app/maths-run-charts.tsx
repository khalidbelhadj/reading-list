import React from "react";

import {
  type ChartColumn,
  ChartLegend,
  ColumnChart,
} from "@/components/system/column-chart";
import { type Attempt, formatProblem, formatSeconds } from "@/lib/mental-maths";

// Thinking times bucketed into whole seconds, the last bucket open-ended.
const BIN_COUNT = 8;

const binIndex = (ms: number) =>
  Math.min(BIN_COUNT, Math.floor(Math.max(0, ms) / 1000));

const binLabel = (index: number) =>
  index === BIN_COUNT ? `${BIN_COUNT}s+` : `${index}s`;

const binRange = (index: number) =>
  index === BIN_COUNT
    ? `${BIN_COUNT} seconds or more`
    : `${index} to ${index + 1} seconds`;

// How the run's thinking times were spread: a count per second-wide bin.
// The fullest bin carries its count; the rest are in the tooltips.
export const ThinkingTimeHistogram = ({
  attempts,
  className,
}: {
  attempts: Attempt[];
  className?: string;
}) => {
  const columns = React.useMemo<ChartColumn[]>(() => {
    const counts = Array.from({ length: BIN_COUNT + 1 }, () => 0);
    for (const attempt of attempts) {
      const index = binIndex(attempt.ms);
      counts[index] = (counts[index] ?? 0) + 1;
    }
    const fullest = Math.max(...counts);
    return counts.map((count, index) => ({
      key: String(index),
      value: count,
      label: binLabel(index),
      valueLabel: count > 0 && count === fullest ? count : undefined,
      tooltip: `${count} in ${binRange(index)}`,
    }));
  }, [attempts]);
  return (
    <ColumnChart
      aria-label="Thinking time distribution"
      columns={columns}
      height={80}
      className={className}
    />
  );
};

// The run as it happened: one column per problem, in order, as tall as the
// thinking took, coloured by whether you had it. The slowest carries its time.
export const RunTimeline = ({
  attempts,
  className,
}: {
  attempts: Attempt[];
  className?: string;
}) => {
  const columns = React.useMemo<ChartColumn[]>(() => {
    const slowest = Math.max(...attempts.map((attempt) => attempt.ms));
    return attempts.map((attempt, index) => ({
      key: String(index),
      value: attempt.ms,
      tone: attempt.correct ? "accent" : "destructive",
      valueLabel:
        attempt.ms === slowest ? formatSeconds(attempt.ms) : undefined,
      tooltip: `${formatProblem(attempt.problem)} = ${attempt.problem.answer}, ${formatSeconds(attempt.ms)}, ${attempt.correct ? "got it" : "missed"}`,
    }));
  }, [attempts]);
  return (
    <div className={className}>
      <ColumnChart
        aria-label="Each problem's thinking time, in order"
        columns={columns}
        height={80}
      />
      <ChartLegend
        className="mt-2"
        items={[
          { tone: "accent", label: "Got it" },
          { tone: "destructive", label: "Missed" },
        ]}
      />
    </div>
  );
};
