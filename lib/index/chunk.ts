// Pure markdown chunking for the index. Splits a document into embedding-
// sized pieces along its own structure (headings, then paragraphs) so each
// chunk reads as a coherent passage, and carries its heading path so the
// embedding knows what the passage is about even out of context.

export type Chunk = {
  ordinal: number;
  heading: string | null;
  text: string;
};

// ~350 tokens per chunk: small enough to be about one thing, large enough to
// carry an argument. Overlong single blocks (a wall of PDF text) are cut at
// sentence boundaries where possible.
const TARGET_CHARS = 1400;
const MAX_CHARS = 2000;
// Long documents are capped: a 300-page PDF is not worth 400 embeddings for
// topic-level retrieval, and the front of a document is where the framing
// lives. Best-effort by design.
export const MAX_CHUNKS_PER_DOCUMENT = 48;

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

// Split one oversized block into pieces at sentence ends (or hard cuts).
const splitLong = (block: string): string[] => {
  const pieces: string[] = [];
  let rest = block.trim();
  while (rest.length > MAX_CHARS) {
    const window = rest.slice(0, MAX_CHARS);
    const cutAt = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("? "),
      window.lastIndexOf("! "),
      window.lastIndexOf("\n"),
    );
    const cut = cutAt > TARGET_CHARS / 2 ? cutAt + 1 : MAX_CHARS;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0) pieces.push(rest);
  return pieces;
};

// Blocks separated by blank lines, with code fences kept whole.
const splitBlocks = (markdown: string): string[] => {
  const blocks: string[] = [];
  let current: string[] = [];
  let fence = false;
  const flush = () => {
    const text = current.join("\n").trim();
    if (text.length > 0) blocks.push(text);
    current = [];
  };
  for (const line of markdown.split("\n")) {
    if (/^(`{3,}|~{3,})/.test(line.trim())) fence = !fence;
    if (!fence && line.trim().length === 0) {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  return blocks;
};

export const chunkMarkdown = (markdown: string): Chunk[] => {
  const chunks: Chunk[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];
  let bufferHeading: string | null = null;

  const flush = () => {
    const text = buffer.join("\n\n").trim();
    if (text.length > 0) {
      chunks.push({ ordinal: chunks.length, heading: bufferHeading, text });
    }
    buffer = [];
  };

  for (const block of splitBlocks(markdown)) {
    const headingMatch = block.match(HEADING);
    if (headingMatch && !block.includes("\n")) {
      // A heading closes the current chunk and labels what follows.
      flush();
      heading = headingMatch[2] ?? null;
      bufferHeading = heading;
      continue;
    }
    for (const piece of block.length > MAX_CHARS ? splitLong(block) : [block]) {
      const pending = buffer.join("\n\n").length;
      if (pending > 0 && pending + piece.length + 2 > TARGET_CHARS) flush();
      if (buffer.length === 0) bufferHeading = heading;
      buffer.push(piece);
    }
    if (chunks.length >= MAX_CHUNKS_PER_DOCUMENT) break;
  }
  flush();
  return chunks.slice(0, MAX_CHUNKS_PER_DOCUMENT);
};

// The text that is actually embedded: the chunk's context line (the
// document title and heading path, as stored in chunks.heading) as a prefix,
// so a passage like "It uses a quorum of replicas" still embeds near "Raft".
export const chunkEmbeddingText = (chunk: {
  heading: string | null;
  text: string;
}) => (chunk.heading ? `${chunk.heading}\n\n${chunk.text}` : chunk.text);

// The stored context line for a chunk: document title, then its heading.
export const chunkContext = (title: string | null, heading: string | null) =>
  [title, heading].filter(Boolean).join(" / ") || null;
