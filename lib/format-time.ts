// Time formatting helpers. All bucketing uses Math.floor so "1 day ago" means
// "at least 24 hours, less than 48," consistently.
const SECOND = 1000;
const MINUTE = 60 * SECOND;

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
