import { describe, expect, it } from "bun:test";

import {
  extractSideRaw,
  findCardClose,
  parseCardsFromNotes,
  replaceCardInNotes,
} from "@/lib/card-parse";

describe("findCardClose", () => {
  const at = (lines: string[]) => (i: number) => lines[i];

  it("finds a standalone </card> line", () => {
    const lines = ["<front>", "q", "</front>", "</card>"];
    expect(findCardClose(at(lines), 0, lines.length)).toBe(3);
  });

  it("ignores </card> inside a code fence", () => {
    const lines = ["<front>", "```", "</card>", "```", "</front>", "</card>"];
    expect(findCardClose(at(lines), 0, lines.length)).toBe(5);
  });

  it("ignores a mid-line </card>", () => {
    const lines = ["<front>", 'parse("</card>")', "</front>", "</card>"];
    expect(findCardClose(at(lines), 0, lines.length)).toBe(3);
  });

  it("returns -1 when unterminated", () => {
    const lines = ["<front>", "q", "</front>"];
    expect(findCardClose(at(lines), 0, lines.length)).toBe(-1);
  });
});

describe("extractSideRaw", () => {
  it("returns content verbatim (no trim, no sentinel strip)", () => {
    const body = ["<front>", "  spaced  ", "&nbsp;", "</front>"];
    expect(extractSideRaw(body, "front")).toBe("  spaced  \n&nbsp;");
  });

  it("preserves a code block containing the closing tag", () => {
    const body = ["<front>", "```", "</front>", "```", "</front>"];
    expect(extractSideRaw(body, "front")).toBe("```\n</front>\n```");
  });

  it("returns empty string when the side is absent", () => {
    expect(extractSideRaw(["<back>", "a", "</back>"], "front")).toBe("");
  });

  it("extracts the back side independently", () => {
    const body = ["<front>", "q", "</front>", "<back>", "a", "</back>"];
    expect(extractSideRaw(body, "back")).toBe("a");
  });
});

describe("replaceCardInNotes", () => {
  const notes = [
    "intro text",
    '<card id="aaaa1111">',
    "<front>",
    "old front",
    "</front>",
    "<back>",
    "old back",
    "</back>",
    "</card>",
    "middle",
    '<card id="bbbb2222">',
    "<front>",
    "keep front",
    "</front>",
    "<back>",
    "keep back",
    "</back>",
    "</card>",
    "outro",
  ].join("\n");

  it("rewrites only the matching card, preserving everything else", () => {
    const result = replaceCardInNotes(
      notes,
      "aaaa1111",
      "new front",
      "new back",
    );
    expect(result).toContain("new front");
    expect(result).toContain("new back");
    expect(result).not.toContain("old front");
    expect(result).toContain("keep front");
    expect(result).toContain("intro text");
    expect(result).toContain("outro");
    // The rewritten notes still parse to the same two cards.
    const cards = parseCardsFromNotes(result!);
    expect(cards.map((c) => c.id)).toEqual(["aaaa1111", "bbbb2222"]);
    expect(cards[0]!.front).toBe("new front");
    expect(cards[1]!.back).toBe("keep back");
  });

  it("returns null when the id is not present", () => {
    expect(replaceCardInNotes(notes, "missing00", "f", "b")).toBeNull();
  });

  it("ignores card-looking markup inside code fences", () => {
    const fenced = [
      "```",
      '<card id="aaaa1111">',
      "```",
      '<card id="aaaa1111">',
      "<front>",
      "real",
      "</front>",
      "<back>",
      "real back",
      "</back>",
      "</card>",
    ].join("\n");
    const result = replaceCardInNotes(
      fenced,
      "aaaa1111",
      "edited",
      "edited back",
    );
    expect(result).not.toBeNull();
    // The fenced fake stays untouched...
    expect(result).toContain('```\n<card id="aaaa1111">\n```');
    // ...and the real card got the edit.
    const cards = parseCardsFromNotes(result!);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.front).toBe("edited");
  });

  it("escapes structural-tag lines typed into a side", () => {
    const result = replaceCardInNotes(
      notes,
      "aaaa1111",
      "q\n</card>\nmore",
      "a",
    );
    expect(result).not.toBeNull();
    // The document still parses into two intact cards — the typed `</card>`
    // did not close the block early.
    const cards = parseCardsFromNotes(result!);
    expect(cards.map((c) => c.id)).toEqual(["aaaa1111", "bbbb2222"]);
    expect(cards[0]!.front).toContain("\\</card>");
  });

  it("round-trips: rewriting with parsed values is content-stable", () => {
    const cards = parseCardsFromNotes(notes);
    const result = replaceCardInNotes(
      notes,
      "aaaa1111",
      cards[0]!.front,
      cards[0]!.back,
    );
    expect(parseCardsFromNotes(result!)).toEqual(cards);
  });
});
