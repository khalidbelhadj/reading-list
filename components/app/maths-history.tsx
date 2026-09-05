import React from "react";

import {
  type ChartColumn,
  ColumnChart,
} from "@/components/system/column-chart";
import { EmptyState } from "@/components/system/empty-state";
import { formatSeconds, type RunRecord } from "@/lib/mental-maths";
import { cn } from "@/lib/utils";

// How many past runs the chart shows; older ones still count in the totals.
const SHOWN_RUNS = 20;
const CHART_HEIGHT = 56;

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="font-content text-title font-medium tabular-nums">
      {value}
    </span>
    <span className="text-small text-muted-foreground">{label}</span>
  </div>
);

// The record behind one configuration, shown while choosing it: how many
// runs, the best, the typical, and solved-per-run over the recent runs with
// the best one labelled. Takes runs already filtered to the configuration.
export const MathsHistory = ({
  runs,
  className,
}: {
  runs: RunRecord[];
  className?: string;
}) => {
  const recent = React.useMemo(
    () => [...runs].sort((a, b) => a.at.localeCompare(b.at)).slice(-SHOWN_RUNS),
    [runs],
  );
  const best = Math.max(0, ...runs.map((run) => run.solved));
  const averageSolved = runs.length
    ? runs.reduce((sum, run) => sum + run.solved, 0) / runs.length
    : 0;
  const averageMs = runs.length
    ? runs.reduce((sum, run) => sum + run.averageMs, 0) / runs.length
    : 0;
  const columns = React.useMemo<ChartColumn[]>(() => {
    const bestIndex = recent.reduce(
      (found, run, index) =>
        run.solved > (recent[found]?.solved ?? -1) ? index : found,
      0,
    );
    return recent.map((run, index) => ({
      key: run.at,
      value: run.solved,
      tone: index === recent.length - 1 ? "accent" : "muted",
      valueLabel: index === bestIndex ? run.solved : undefined,
      tooltip: `${run.solved} of ${run.attempts} on ${dateFormat.format(new Date(run.at))}, ${formatSeconds(run.averageMs)} each`,
    }));
  }, [recent]);

  const empty = runs.length === 0;

  // The empty case keeps the filled layout's exact height: dashes in the
  // stat slots and the hint where the columns would be, above the same
  // baseline, so the block never shifts as the first run lands.
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-4 gap-4">
        <Stat
          label={runs.length === 1 ? "Run" : "Runs"}
          value={empty ? "–" : String(runs.length)}
        />
        <Stat label="Best" value={empty ? "–" : String(best)} />
        <Stat label="Typical" value={empty ? "–" : averageSolved.toFixed(1)} />
        <Stat
          label="Per answer"
          value={empty ? "–" : formatSeconds(averageMs)}
        />
      </div>
      {empty ? (
        <div className="flex flex-col">
          <div
            className="flex items-center justify-center"
            style={{ height: CHART_HEIGHT }}
          >
            <EmptyState
              title="No runs yet"
              description="Your first run with these settings will show up here."
            />
          </div>
          <div className="h-px bg-foreground/10" />
        </div>
      ) : (
        <ColumnChart
          aria-label="Solved per run, oldest to newest"
          columns={columns}
          height={CHART_HEIGHT}
        />
      )}
    </div>
  );
};
