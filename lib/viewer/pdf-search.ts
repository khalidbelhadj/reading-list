// Text-search primitives for the PDF engine: normalization, occurrence
// scanning, and the geometry of a hit on a rendered page. Shared by the
// document-wide search hook and by each page's highlight layer, so both agree
// on what counts as a match.
export type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  active: boolean;
};

// Shortest query worth matching — one character lights up half the document.
// Shared by the search hook, the sidebar, and the highlight geometry so they
// can't disagree about when a query is "on".
export const MIN_SEARCH_QUERY = 2;

// Case- and accent-insensitive, and crucially **length-preserving**: every
// input UTF-16 unit maps to exactly one output character. Offsets found in the
// normalized text therefore index straight back into the original, which is
// what lets a hit be sliced back onto the exact spans that hold it. (A plain
// `NFKD` normalize would be more thorough and completely break that.)
export const normalizeForSearch = (value: string): string => {
  let out = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";
    const lower = char.toLowerCase();
    const stripped = lower.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    out += stripped[0] ?? lower[0] ?? char;
  }
  return out;
};

// Offsets of every occurrence of `needle` in `haystack` (both normalized).
export const findOccurrences = (haystack: string, needle: string): number[] => {
  if (!needle) return [];
  const found: number[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return found;
    found.push(at);
    from = at + needle.length;
  }
};

type MatchSlice = { item: number; start: number; end: number };

// A match found in a page's concatenated text, cut back into per-item slices.
// pdf.js splits glyph runs mid-word constantly, so a hit routinely straddles
// two or three spans and needs a box for each.
const sliceMatch = (
  offsets: number[],
  lengths: number[],
  at: number,
  length: number,
): MatchSlice[] => {
  const slices: MatchSlice[] = [];
  const matchEnd = at + length;
  for (let item = 0; item < lengths.length; item += 1) {
    const itemLength = lengths[item] ?? 0;
    const itemStart = offsets[item] ?? 0;
    if (itemStart + itemLength <= at) continue;
    if (itemStart >= matchEnd) break;
    slices.push({
      item,
      start: Math.max(0, at - itemStart),
      end: Math.min(itemLength, matchEnd - itemStart),
    });
  }
  return slices;
};

// Boxes for every hit on one rendered page.
//
// Rects are measured with DOM Ranges over the spans pdf.js actually rendered —
// the only way to get them right when a run carries a horizontal squeeze
// (--scale-x) or a rotation — then stored as *fractions* of the text layer.
// Fractions are what make zoom free: the boxes are laid out in percentages, so
// they rescale with the page and nothing is recomputed until the query changes.
export const computeHighlightRects = ({
  divs,
  strings,
  container,
  query,
  activeOrdinal,
}: {
  divs: HTMLElement[];
  strings: string[];
  container: HTMLElement;
  query: string;
  // Which hit on this page is the one the reader jumped to, if any.
  activeOrdinal: number | null;
}): HighlightRect[] => {
  const needle = normalizeForSearch(query);
  if (needle.length < MIN_SEARCH_QUERY || strings.length === 0) return [];

  const offsets: number[] = new Array<number>(strings.length);
  const lengths: number[] = new Array<number>(strings.length);
  let running = 0;
  for (let index = 0; index < strings.length; index += 1) {
    const value = strings[index] ?? "";
    offsets[index] = running;
    lengths[index] = value.length;
    running += value.length;
  }

  const bounds = container.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return [];

  const rects: HighlightRect[] = [];
  const hits = findOccurrences(normalizeForSearch(strings.join("")), needle);
  hits.forEach((at, ordinal) => {
    const active = ordinal === activeOrdinal;
    for (const slice of sliceMatch(offsets, lengths, at, needle.length)) {
      const node = divs[slice.item]?.firstChild;
      if (!node) continue;
      const range = document.createRange();
      try {
        range.setStart(node, slice.start);
        range.setEnd(node, slice.end);
      } catch {
        continue;
      }
      for (const rect of range.getClientRects()) {
        if (rect.width === 0 || rect.height === 0) continue;
        rects.push({
          left: (rect.left - bounds.left) / bounds.width,
          top: (rect.top - bounds.top) / bounds.height,
          width: rect.width / bounds.width,
          height: rect.height / bounds.height,
          active,
        });
      }
    }
  });
  return rects;
};
