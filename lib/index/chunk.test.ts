import { describe, expect, it } from "bun:test";

import {
  chunkContext,
  chunkEmbeddingText,
  chunkMarkdown,
  MAX_CHUNKS_PER_DOCUMENT,
} from "./chunk";

describe("chunkMarkdown", () => {
  it("labels chunks with the heading they fall under", () => {
    const chunks = chunkMarkdown(
      "# Intro\n\nHello there.\n\n## Consensus\n\nRaft elects a leader.\n\nPaxos does not.",
    );
    expect(chunks.map((chunk) => chunk.heading)).toEqual([
      "Intro",
      "Consensus",
    ]);
    expect(chunks[1]?.text).toBe("Raft elects a leader.\n\nPaxos does not.");
  });

  it("packs paragraphs up to the target size and then starts a new chunk", () => {
    const paragraph = "word ".repeat(100).trim(); // ~500 chars: two fit, three do not
    const chunks = chunkMarkdown(
      [paragraph, paragraph, paragraph].join("\n\n"),
    );
    expect(chunks.length).toBe(2);
    expect(chunks[0]?.text.length).toBeLessThan(2000);
  });

  it("cuts an oversized block at a sentence boundary", () => {
    const sentence = "This is a sentence about systems. ";
    const wall = sentence.repeat(120);
    const chunks = chunkMarkdown(wall);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(2000);
      expect(chunk.text.endsWith(".")).toBe(true);
    }
  });

  it("keeps a code fence together even across blank lines", () => {
    const chunks = chunkMarkdown("```ts\nconst a = 1;\n\nconst b = 2;\n```");
    expect(chunks.length).toBe(1);
    expect(chunks[0]?.text).toContain("const b = 2;");
  });

  it("caps the number of chunks per document", () => {
    const paragraph = "x".repeat(1500);
    const chunks = chunkMarkdown(Array(80).fill(paragraph).join("\n\n"));
    expect(chunks.length).toBe(MAX_CHUNKS_PER_DOCUMENT);
  });

  it("prefixes the embedding text with the title and heading", () => {
    const [chunk] = chunkMarkdown("## Leases\n\nA lease is a timed lock.");
    const heading = chunkContext("Chubby", chunk!.heading);
    expect(heading).toBe("Chubby / Leases");
    expect(chunkEmbeddingText({ heading, text: chunk!.text })).toBe(
      "Chubby / Leases\n\nA lease is a timed lock.",
    );
    expect(chunkContext(null, null)).toBeNull();
  });
});
