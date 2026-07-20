import { describe, expect, test } from "bun:test";

import { chunkMarkdown, MAX_CHUNKS_PER_ITEM } from "./chunk";

describe("chunkMarkdown", () => {
  test("short document is a single chunk", () => {
    const chunks = chunkMarkdown("# Title\n\nA short paragraph.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("A short paragraph.");
  });

  test("splits long documents and keeps every chunk under the cap", () => {
    const paragraph = "Lorem ipsum dolor sit amet. ".repeat(40);
    const markdown = Array.from(
      { length: 20 },
      (_, i) => `## Section ${i}\n\n${paragraph}`,
    ).join("\n\n");
    const chunks = chunkMarkdown(markdown);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(3600);
    }
    // Nothing lost: total content survives chunking (modulo whitespace).
    const joined = chunks.join("\n\n").replace(/\s+/g, " ");
    expect(joined).toContain("Section 19");
  });

  test("never severs a fenced code block", () => {
    const code = "```ts\nconst x = 1;\n\nconst y = 2;\n```";
    const chunks = chunkMarkdown(`Intro paragraph.\n\n${code}\n\nOutro.`);
    const withFence = chunks.find((chunk) => chunk.includes("```ts"));
    expect(withFence).toBeDefined();
    // Opening and closing fences stay together.
    expect((withFence?.match(/```/g) ?? []).length).toBe(2);
  });

  test("caps runaway documents at MAX_CHUNKS_PER_ITEM", () => {
    const markdown = Array.from(
      { length: 500 },
      (_, i) => `## H${i}\n\n${"word ".repeat(700)}`,
    ).join("\n\n");
    expect(chunkMarkdown(markdown).length).toBeLessThanOrEqual(
      MAX_CHUNKS_PER_ITEM,
    );
  });

  test("giant single paragraph is hard-split", () => {
    const chunks = chunkMarkdown("word ".repeat(3000));
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(3600);
    }
  });
});
