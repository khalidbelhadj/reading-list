import { describe, expect, it } from "bun:test";

import { findOccurrences, normalizeForSearch } from "@/lib/viewer/pdf-search";

describe("normalizeForSearch", () => {
  it("lowercases", () => {
    expect(normalizeForSearch("Attention")).toBe("attention");
  });

  it("strips accents so plain ASCII finds accented text", () => {
    expect(normalizeForSearch("résumé")).toBe("resume");
    expect(normalizeForSearch("Poincaré")).toBe("poincare");
  });

  // The whole slice-a-hit-back-onto-its-spans scheme depends on this: offsets
  // found in the normalized text are used to index the original string, so a
  // normalization that changed the length would silently misplace highlights.
  it("preserves length for every input", () => {
    for (const value of [
      "résumé",
      "Poincaré–Bendixson",
      "ﬁnite",
      "İstanbul",
      "Ångström",
      "égalité",
      "數學",
      "😀 emoji",
    ]) {
      expect(normalizeForSearch(value)).toHaveLength(value.length);
    }
  });

  it("leaves text with nothing to normalize untouched", () => {
    expect(normalizeForSearch("plain ascii 123")).toBe("plain ascii 123");
  });
});

describe("findOccurrences", () => {
  it("finds every non-overlapping occurrence", () => {
    expect(findOccurrences("abcabcabc", "abc")).toEqual([0, 3, 6]);
  });

  it("does not report overlapping matches twice", () => {
    expect(findOccurrences("aaaa", "aa")).toEqual([0, 2]);
  });

  it("returns nothing for an empty needle or no match", () => {
    expect(findOccurrences("abc", "")).toEqual([]);
    expect(findOccurrences("abc", "z")).toEqual([]);
  });

  // pdf.js splits glyph runs mid-word, so page text is joined with no
  // separator and a hit routinely straddles the join.
  it("finds a term split across text items once they are joined", () => {
    const joined = ["sea", "rch ", "results"].join("");
    expect(findOccurrences(joined, "search")).toEqual([0]);
  });
});
