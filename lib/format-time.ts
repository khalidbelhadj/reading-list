// Time formatting helpers. All bucketing uses Math.floor so "1 day ago" means
// "at least 24 hours, less than 48," consistently.
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (n: number, unit: string) =>
  `${n} ${n === 1 ? unit : `${unit}s`} ago`;

// Long-form, e.g. "3 hours ago", "just now". Used for read-list timestamps
// and review-nudge "last reviewed ..." copy.
export const relativeTime = (dateStr: string): string => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diffMs / SECOND);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return plural(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return plural(days, "day");
  const months = Math.floor(days / 30);
  if (months < 12) return plural(months, "month");
  const years = Math.floor(months / 12);
  return plural(years, "year");
};

// Short SRS interval, e.g. "30m", "5h", "2d", "3mo". Always at least "1m"
// for non-negative intervals so "due in a few seconds" still renders.
export const intervalShort = (dueIso: string, nowIso: string): string => {
  const ms = new Date(dueIso).getTime() - new Date(nowIso).getTime();
  const minutes = Math.floor(ms / MINUTE);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
};

// Elapsed duration, e.g. "45s", "2m", "2m 13s".
export const duration = (ms: number): string => {
  const seconds = Math.floor(ms / SECOND);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
};
