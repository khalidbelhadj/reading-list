import { ChartLegend, ColumnChart } from "./column-chart";
import { type Demo } from "./demo";

const WEEK = [
  { key: "mon", label: "Mon", value: 4 },
  { key: "tue", label: "Tue", value: 7 },
  { key: "wed", label: "Wed", value: 3 },
  { key: "thu", label: "Thu", value: 9 },
  { key: "fri", label: "Fri", value: 6 },
  { key: "sat", label: "Sat", value: 0 },
  { key: "sun", label: "Sun", value: 2 },
];

export const demo: Demo = {
  title: "Column chart",
  description:
    "One series of thin columns on a hairline baseline, a tooltip per column. Accent, muted, or destructive tones, with a legend when two mix.",
  render: () => (
    <div className="flex w-full max-w-md flex-col gap-8">
      <ColumnChart
        aria-label="Items read per day this week"
        columns={WEEK.map((day) => ({
          ...day,
          valueLabel: day.value === 9 ? "9" : undefined,
          tooltip: `${day.value} read on ${day.label}`,
        }))}
      />
      <div className="flex flex-col gap-2">
        <ColumnChart
          aria-label="Attempts in order"
          height={64}
          columns={[3.1, 1.2, 0.9, 4.8, 1.6, 2.2, 0.7, 5.4, 1.1, 1.9].map(
            (seconds, index) => ({
              key: String(index),
              value: seconds,
              tone: index === 3 || index === 7 ? "destructive" : "accent",
              tooltip: `${seconds.toFixed(1)}s`,
            }),
          )}
        />
        <ChartLegend
          items={[
            { tone: "accent", label: "Got it" },
            { tone: "destructive", label: "Missed" },
          ]}
        />
      </div>
      <ColumnChart
        aria-label="Context series"
        height={48}
        columns={WEEK.map((day) => ({ ...day, tone: "muted" }))}
      />
    </div>
  ),
};
