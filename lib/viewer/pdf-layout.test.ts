import { describe, expect, it } from "bun:test";

import {
  buildPdfLayout,
  contentHeight,
  fitScale,
  pageIndexAt,
  pageTop,
  type PdfPageSize,
  visibleRange,
} from "@/lib/viewer/pdf-layout";

// Two portrait pages around one landscape plate — the shape the old
// "every page matches page 1" assumption got wrong.
const MIXED: PdfPageSize[] = [
  { width: 600, height: 800 },
  { width: 1000, height: 500 },
  { width: 600, height: 800 },
];

const metrics = (scale: number) => ({ scale, gap: 10, padding: 20 });

describe("buildPdfLayout", () => {
  it("prefixes cumulative base offsets over differing page heights", () => {
    const layout = buildPdfLayout(MIXED, 0);
    expect(layout.offsets).toEqual([0, 800, 1300]);
    expect(layout.totalHeight).toBe(2100);
    expect(layout.maxWidth).toBe(1000);
    expect(layout.maxHeight).toBe(800);
  });

  it("swaps width and height on a quarter turn", () => {
    const layout = buildPdfLayout(MIXED, 90);
    expect(layout.sizes[1]).toEqual({ width: 500, height: 1000 });
    expect(layout.maxWidth).toBe(800);
    expect(layout.maxHeight).toBe(1000);
  });

  it("leaves sizes alone on a half turn", () => {
    expect(buildPdfLayout(MIXED, 180).sizes).toEqual(MIXED);
  });

  it("handles an empty document", () => {
    const layout = buildPdfLayout([], 0);
    expect(layout.count).toBe(0);
    expect(layout.totalHeight).toBe(0);
  });
});

describe("pageTop", () => {
  it("scales page heights but not gaps or padding", () => {
    const layout = buildPdfLayout(MIXED, 0);
    expect(pageTop(layout, 0, metrics(1))).toBe(20);
    expect(pageTop(layout, 1, metrics(1))).toBe(800 + 10 + 20);
    // At 2x only the 800 doubles; the gap and padding are constants.
    expect(pageTop(layout, 1, metrics(2))).toBe(1600 + 10 + 20);
    expect(pageTop(layout, 2, metrics(2))).toBe(2600 + 20 + 20);
  });
});

describe("contentHeight", () => {
  it("counts every gap between pages plus padding on both ends", () => {
    const layout = buildPdfLayout(MIXED, 0);
    expect(contentHeight(layout, metrics(1))).toBe(2100 + 20 + 40);
  });

  it("adds no gap for a single-page document", () => {
    const layout = buildPdfLayout([{ width: 600, height: 800 }], 0);
    expect(contentHeight(layout, metrics(1))).toBe(800 + 40);
  });
});

describe("pageIndexAt", () => {
  const layout = buildPdfLayout(MIXED, 0);

  it("resolves an offset inside each page's band", () => {
    expect(pageIndexAt(layout, 20, metrics(1))).toBe(0);
    expect(pageIndexAt(layout, 500, metrics(1))).toBe(0);
    expect(pageIndexAt(layout, 900, metrics(1))).toBe(1);
    expect(pageIndexAt(layout, 1400, metrics(1))).toBe(2);
  });

  it("resolves an offset inside a gap to the page above it", () => {
    // Page 1 ends at 820, page 2 starts at 830.
    expect(pageIndexAt(layout, 825, metrics(1))).toBe(0);
  });

  it("clamps above and below the document", () => {
    expect(pageIndexAt(layout, -5000, metrics(1))).toBe(0);
    expect(pageIndexAt(layout, 999_999, metrics(1))).toBe(2);
  });
});

describe("visibleRange", () => {
  const layout = buildPdfLayout(MIXED, 0);

  it("covers the viewport and pads it by the overscan", () => {
    expect(visibleRange(layout, 0, 100, metrics(1), 0)).toEqual({
      start: 0,
      end: 0,
    });
    expect(visibleRange(layout, 0, 100, metrics(1), 1)).toEqual({
      start: 0,
      end: 1,
    });
  });

  it("never runs past the ends of the document", () => {
    expect(visibleRange(layout, 0, 5000, metrics(1), 5)).toEqual({
      start: 0,
      end: 2,
    });
  });

  it("returns an empty range for an empty document", () => {
    expect(visibleRange(buildPdfLayout([], 0), 0, 500, metrics(1), 2)).toEqual({
      start: 0,
      end: -1,
    });
  });
});

describe("fitScale", () => {
  it("divides the available space by the page extent", () => {
    expect(fitScale(1000, 500, { min: 0.25, max: 6 })).toBe(0.5);
  });

  it("clamps to the given bounds", () => {
    expect(fitScale(1000, 10, { min: 0.25, max: 6 })).toBe(0.25);
    expect(fitScale(10, 1000, { min: 0.25, max: 6 })).toBe(6);
  });

  it("falls back to 1 before the stage has been measured", () => {
    expect(fitScale(1000, 0, { min: 0.25, max: 6 })).toBe(1);
    expect(fitScale(0, 1000, { min: 0.25, max: 6 })).toBe(1);
  });
});
