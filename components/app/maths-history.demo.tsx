import { type Demo } from "@/components/system/demo";
import { DEFAULT_SETTINGS, type RunRecord } from "@/lib/mental-maths";

import { MathsHistory } from "./maths-history";

const SOLVED = [8, 11, 9, 13, 12, 15, 14, 12, 17, 16, 19, 18, 21, 17];

// Fourteen runs over two weeks, improving with a couple of off days.
const RUNS: RunRecord[] = SOLVED.map((solved, index) => ({
  at: new Date(Date.UTC(2026, 7, 20 + index, 9, 0, 0)).toISOString(),
  settings: DEFAULT_SETTINGS,
  solved,
  attempts: solved + (index % 3),
  averageMs: 4200 - index * 120 + (index % 4) * 150,
}));

export const demo: Demo = {
  title: "Maths history",
  description:
    "Past runs for one Mental maths configuration: totals, then solved per run. Latest in the accent, best labelled.",
  render: () => (
    <div className="flex w-full max-w-md flex-col gap-8">
      <MathsHistory runs={RUNS} />
      <MathsHistory runs={[]} />
    </div>
  ),
};
