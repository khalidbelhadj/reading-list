import { type Demo } from "@/components/system/demo";
import { type Attempt, type Operation } from "@/lib/mental-maths";

import { RunTimeline, ThinkingTimeHistogram } from "./maths-run-charts";

// A fixed sample run so the board renders the same every time.
const SAMPLE: Array<[Operation, number, number, number, boolean, number]> = [
  ["addition", 47, 38, 85, true, 1400],
  ["multiplication", 12, 9, 108, true, 2300],
  ["subtraction", 92, 45, 47, true, 1900],
  ["division", 84, 7, 12, false, 5200],
  ["addition", 66, 29, 95, true, 1100],
  ["multiplication", 23, 14, 322, false, 7800],
  ["subtraction", 71, 18, 53, true, 900],
  ["addition", 58, 77, 135, true, 1700],
  ["division", 96, 8, 12, true, 3400],
  ["multiplication", 17, 6, 102, true, 2600],
  ["subtraction", 40, 26, 14, true, 800],
  ["addition", 89, 33, 122, false, 4100],
  ["division", 72, 9, 8, true, 2900],
  ["multiplication", 15, 15, 225, true, 1500],
  ["addition", 24, 68, 92, true, 1200],
  ["subtraction", 83, 57, 26, true, 2100],
];

const ATTEMPTS: Attempt[] = SAMPLE.map(
  ([operation, left, right, answer, correct, ms]) => ({
    problem: { operation, left, right, answer },
    correct,
    ms,
  }),
);

export const demo: Demo = {
  title: "Maths run charts",
  description:
    "One run, two ways: thinking time binned by the second, and each problem in order. Hover for the problem.",
  render: () => (
    <div className="flex w-full max-w-md flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-small font-medium text-muted-foreground">
          Thinking time
        </span>
        <ThinkingTimeHistogram attempts={ATTEMPTS} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-small font-medium text-muted-foreground">
          In order
        </span>
        <RunTimeline attempts={ATTEMPTS} />
      </div>
    </div>
  ),
};
