// Heading-aware markdown chunking for the embedding step. Pure and
// client-safe so it can be unit-tested without a server context.

// ~900 tokens at 4 chars/token — well inside gemini-embedding-001's window
// while keeping chunks topically narrow enough to be useful search hits.
const MAX_CHUNK_CHARS = 3600;
// Chunks below this get merged into their neighbor so stray one-liners
// (lone headings, image captions) don't become their own search results.
const MIN_CHUNK_CHARS = 200;
// Hard cap per item: beyond this the document tail goes unindexed. The item
// still embeds (mean vector over what we have) — log-worthy, not fatal.
export const MAX_CHUNKS_PER_ITEM = 96;

// Split into blocks at headings and blank lines, keeping fenced code blocks
// intact so a ``` fence never gets severed mid-chunk.
const splitBlocks = (markdown: string): string[] => {
  const lines = markdown.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  const flush = () => {
    const text = current.join("\n").trim();
    if (text) blocks.push(text);
    current = [];
  };

  for (const line of lines) {
    if (/^(```|~~~)/.test(line.trim())) inFence = !inFence;
    if (!inFence && (/^#{1,6} /.test(line) || line.trim() === "")) {
      if (line.trim() === "") {
        current.push(line);
        flush();
        continue;
      }
      flush();
    }
    current.push(line);
  }
  flush();
  return blocks;
};

// A block longer than the cap (huge paragraph, giant code block) is split at
// sentence-ish boundaries, falling back to a hard cut.
const splitOversized = (block: string): string[] => {
  if (block.length <= MAX_CHUNK_CHARS) return [block];
  const pieces: string[] = [];
  let rest = block;
  while (rest.length > MAX_CHUNK_CHARS) {
    const window = rest.slice(0, MAX_CHUNK_CHARS);
    const cut = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("\n"),
      Math.floor(MAX_CHUNK_CHARS * 0.5),
    );
    pieces.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1);
  }
  if (rest.trim()) pieces.push(rest.trim());
  return pieces;
};

export const chunkMarkdown = (markdown: string): string[] => {
  const blocks = splitBlocks(markdown).flatMap(splitOversized);

  const chunks: string[] = [];
  let current = "";
  for (const block of blocks) {
    if (current && current.length + block.length + 2 > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = block;
    } else {
      current = current ? `${current}\n\n${block}` : block;
    }
  }
  if (current) chunks.push(current);

  // Merge trailing runts backward so no chunk is meaninglessly small.
  const merged: string[] = [];
  for (const chunk of chunks) {
    const prev = merged[merged.length - 1];
    if (
      prev !== undefined &&
      chunk.length < MIN_CHUNK_CHARS &&
      prev.length + chunk.length + 2 <= MAX_CHUNK_CHARS
    ) {
      merged[merged.length - 1] = `${prev}\n\n${chunk}`;
    } else {
      merged.push(chunk);
    }
  }

  return merged.slice(0, MAX_CHUNKS_PER_ITEM);
};
