// Time formatting helpers. All bucketing uses Math.floor so "1 day ago" means
// "at least 24 hours, less than 48," consistently.
const SECOND = 1000;
const MINUTE = 60 * SECOND;

// Coarse relative age for list rows, e.g. "just now", "3h ago", "2d ago".
export const timeAgo = (iso: string, nowIso: string): string => {
  const ms = new Date(nowIso).getTime() - new Date(iso).getTime();
  const minutes = Math.floor(ms / MINUTE);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};
