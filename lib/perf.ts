const PERF_ENABLED =
  process.env.PERF_LOG === "1" || process.env.NODE_ENV === "development";

const fmt = (ms: number) => ms.toFixed(1).padStart(6, " ");

const formatAttrs = (attrs?: Record<string, string | number | boolean>) => {
  if (!attrs) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs)) parts.push(`${k}=${v}`);
  return parts.length ? " " + parts.join(" ") : "";
};

export const time = async <T>(
  label: string,
  fn: () => Promise<T>,
  attrs?: Record<string, string | number | boolean>,
): Promise<T> => {
  if (!PERF_ENABLED) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const elapsed = performance.now() - start;
    console.log(`[perf] ${fmt(elapsed)}ms  ${label}${formatAttrs(attrs)}`);
  }
};

export const perfLog = (
  label: string,
  ms: number,
  attrs?: Record<string, string | number | boolean>,
) => {
  if (!PERF_ENABLED) return;
  console.log(`[perf] ${fmt(ms)}ms  ${label}${formatAttrs(attrs)}`);
};
