import { extractSideRaw, findCardClose } from "@/lib/card-parse";

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
