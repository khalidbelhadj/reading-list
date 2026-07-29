// Document layout for the PDF engine: where every page sits in the scroll
// column, at any scale, in O(1).
//
// The old engine assumed every page matched page 1 — fine for a clean paper,
// wrong for anything with a landscape figure page or a scanned insert, and the
// scrollbar drifted further off with every such page. Here the base (scale-1)
// size of each page is measured once and the cumulative offsets are prefixed,
// so `pageTop` is a multiply and `pageIndexAt` is a binary search. That matters
// because zoom re-lays out the column on every frame of a pinch: the layout has
// to be free to recompute, or the gesture stutters.
export type PdfPageSize = { width: number; height: number };

export type PdfLayout = {
  count: number;
  // Cumulative base height above page i, gaps excluded (they don't scale).
  offsets: number[];
  sizes: PdfPageSize[];
  maxWidth: number;
  totalHeight: number;
};

// Rotation is applied here rather than at render time so the scroll column
// reflows the instant the reader hits rotate, before any pixel is rasterized.
export const buildPdfLayout = (
  sizes: PdfPageSize[],
  rotation: number,
): PdfLayout => {
  const quarterTurn = rotation === 90 || rotation === 270;
  const rotated = sizes.map((size) =>
    quarterTurn ? { width: size.height, height: size.width } : size,
  );
  const offsets: number[] = new Array<number>(rotated.length);
  let running = 0;
  let maxWidth = 0;
  for (let index = 0; index < rotated.length; index += 1) {
    const size = rotated[index];
    if (!size) continue;
    offsets[index] = running;
    running += size.height;
    maxWidth = Math.max(maxWidth, size.width);
  }
  return {
    count: rotated.length,
    offsets,
    sizes: rotated,
    maxWidth,
    totalHeight: running,
  };
};

export type PdfMetrics = { scale: number; gap: number; padding: number };

export const pageTop = (
  layout: PdfLayout,
  index: number,
  { scale, gap, padding }: PdfMetrics,
): number => (layout.offsets[index] ?? 0) * scale + index * gap + padding;

export const pageSize = (
  layout: PdfLayout,
  index: number,
  scale: number,
): PdfPageSize => {
  const size = layout.sizes[index];
  if (!size) return { width: 0, height: 0 };
  return { width: size.width * scale, height: size.height * scale };
};

export const contentHeight = (
  layout: PdfLayout,
  { scale, gap, padding }: PdfMetrics,
): number =>
  layout.totalHeight * scale +
  Math.max(0, layout.count - 1) * gap +
  padding * 2;

// Index of the page whose band contains `offset` (a scroll-space y). Offsets
// inside a gap resolve to the page above, which is what a "current page"
// readout wants.
export const pageIndexAt = (
  layout: PdfLayout,
  offset: number,
  metrics: PdfMetrics,
): number => {
  let low = 0;
  let high = layout.count - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (pageTop(layout, middle, metrics) <= offset) low = middle;
    else high = middle - 1;
  }
  return Math.max(0, Math.min(low, layout.count - 1));
};

// The [first, last] page range covering a viewport window, padded by
// `overscan` pages either side so scrolling reveals rendered pages rather than
// placeholders.
export const visibleRange = (
  layout: PdfLayout,
  scrollTop: number,
  viewportHeight: number,
  metrics: PdfMetrics,
  overscan: number,
): { start: number; end: number } => {
  if (layout.count === 0) return { start: 0, end: -1 };
  const first = pageIndexAt(layout, scrollTop, metrics);
  const last = pageIndexAt(layout, scrollTop + viewportHeight, metrics);
  return {
    start: Math.max(0, first - overscan),
    end: Math.min(layout.count - 1, last + overscan),
  };
};

// Scale that makes the widest page fit `available` css px, clamped so a
// pathological page can't collapse the column.
export const fitScale = (
  extent: number,
  available: number,
  { min, max }: { min: number; max: number },
): number => {
  if (extent <= 0 || available <= 0) return 1;
  return Math.max(min, Math.min(max, available / extent));
};
