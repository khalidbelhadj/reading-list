import { describe, expect, test } from "bun:test";

import { classifyUrl, getArxivId, getPdfUrl } from "./classify";

describe("classifyUrl", () => {
  test("youtube watch/short/embed urls", () => {
    expect(classifyUrl("https://www.youtube.com/watch?v=kCc8FmEb1nY")).toBe(
      "youtube",
    );
    expect(classifyUrl("https://youtu.be/kCc8FmEb1nY")).toBe("youtube");
  });

  test("arxiv abs and pdf urls", () => {
    expect(classifyUrl("https://arxiv.org/abs/1706.03762")).toBe("arxiv");
    expect(classifyUrl("https://arxiv.org/pdf/1706.03762")).toBe("arxiv");
    expect(classifyUrl("https://arxiv.org/pdf/1706.03762.pdf")).toBe("arxiv");
  });

  test("pdf by suffix", () => {
    expect(classifyUrl("https://example.com/paper.PDF")).toBe("pdf");
  });

  test("everything else is web", () => {
    expect(classifyUrl("https://paulgraham.com/greatwork.html")).toBe("web");
    expect(classifyUrl("not a url")).toBe("web");
  });
});

describe("getArxivId", () => {
  test("strips .pdf suffix and version survives", () => {
    expect(getArxivId("https://arxiv.org/abs/2103.00020v2")).toBe(
      "2103.00020v2",
    );
    expect(getArxivId("https://arxiv.org/pdf/2103.00020.pdf")).toBe(
      "2103.00020",
    );
  });

  test("old-style ids with a slash", () => {
    expect(getArxivId("https://arxiv.org/abs/cs/0112017")).toBe("cs/0112017");
  });
});

describe("getPdfUrl", () => {
  test("rewrites arxiv abs to pdf", () => {
    expect(getPdfUrl("https://arxiv.org/abs/1706.03762")).toBe(
      "https://arxiv.org/pdf/1706.03762",
    );
  });

  test("null for non-pdf", () => {
    expect(getPdfUrl("https://example.com/post")).toBeNull();
  });
});
