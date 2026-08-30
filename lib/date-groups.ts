// Bucket a timestamp into the date groups the lists use: Today, Yesterday,
// This week, This month, then one group per month. `sortKey` orders groups
// newest first. Mirrors the classic list's buckets so both agree.
export type DateGroup = { key: string; label: string; sortKey: number };

const startOfDay = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const dateGroup = (iso: string, now: Date): DateGroup => {
  const at = new Date(iso);
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(at).getTime()) / 86_400_000,
  );
  if (diffDays === 0) return { key: "today", label: "Today", sortKey: 1e15 };
  if (diffDays === 1)
    return { key: "yesterday", label: "Yesterday", sortKey: 1e15 - 1 };
  if (diffDays < 7)
    return { key: "this-week", label: "This week", sortKey: 1e15 - 2 };
  if (
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth()
  ) {
    return { key: "this-month", label: "This month", sortKey: 1e15 - 3 };
  }
  return {
    key: `month-${at.getFullYear()}-${at.getMonth()}`,
    label: at.toLocaleString("en-GB", { month: "long", year: "numeric" }),
    sortKey: at.getFullYear() * 12 + at.getMonth(),
  };
};

// Group a list by the date read from each entry, groups newest first and
// entries within a group newest first.
export const groupByDate = <T>(
  entries: T[],
  dateOf: (entry: T) => string,
  now: Date,
): { group: DateGroup; entries: T[] }[] => {
  const groups = new Map<string, { group: DateGroup; entries: T[] }>();
  for (const entry of entries) {
    const group = dateGroup(dateOf(entry), now);
    const bucket = groups.get(group.key) ?? { group, entries: [] };
    bucket.entries.push(entry);
    groups.set(group.key, bucket);
  }
  return [...groups.values()]
    .map((bucket) => ({
      ...bucket,
      entries: bucket.entries
        .slice()
        .sort((a, b) => dateOf(b).localeCompare(dateOf(a))),
    }))
    .sort((a, b) => b.group.sortKey - a.group.sortKey);
};
