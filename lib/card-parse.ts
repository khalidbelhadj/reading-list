// Pure, dependency-light parsing for inline `<card>` blocks. Shared by the
// server-side notes→DB sync (lib/flashcard-sync.server.ts) and the client
// editor's card node (components/app/flashcard-node.tsx), so it must NOT
// import the DB or any server-only module.
//
// The hard requirement is robustness against delimiter-looking text the user
// can legitimately write inside code — `</card>` in a code block must not close
// the block early. Two defenses, used everywhere a tag is matched:
//   1. Structural tags match ONLY as standalone lines (`^</card>$`), so mid-line
//      text like `parse("</card>")` is never treated as a delimiter.
//   2. Scanning is fence-aware — lines inside a ``` / ~~~ code fence are skipped,
//      so even a line that is literally `</card>` inside a code block is content.
import { newCardId } from "@/lib/card-id";
import { stripBlankLineSentinel } from "@/lib/markdown";

const FENCE = /^(`{3,}|~{3,})/;
const CARD_OPEN = /^<card\b([^>]*)>$/i;
const CARD_CLOSE = /^<\/card>$/i;
export const ID_ATTR = /\bid\s*=\s*"([^"]+)"/i;

export type ParsedCard = {
  id: string | null;
  front: string;
  back: string;
};

// Index of the standalone `</card>` line at or after `start` (exclusive of any
// inner code fence), or -1 if the block is unterminated. `getLine` returns a
// line's text or undefined past the end; `end` bounds the search.
export const findCardClose = (
  getLine: (index: number) => string | undefined,
  start: number,
  end: number,
): number => {
  let fence = false;
  for (let i = start; i < end; i++) {
    const line = getLine(i);
    if (line === undefined) break;
    const trimmed = line.trim();
    if (FENCE.test(trimmed)) {
      fence = !fence;
      continue;
    }
    if (!fence && CARD_CLOSE.test(trimmed)) return i;
  }
  return -1;
};

// Raw markdown between `<name>` and `</name>` within a card body (fence-aware so
// code content holding `</front>` etc. isn't mistaken for the closing tag).
// Returns "" when the side is absent. Not trimmed and not sentinel-stripped —
// callers decide (the editor renders it as-is; sync cleans it for storage).
export const extractSideRaw = (
  body: string[],
  name: "front" | "back",
): string => {
  const open = new RegExp(`^<${name}>$`, "i");
  const close = new RegExp(`^</${name}>$`, "i");

  let start = -1;
  let fence = false;
  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    if (line === undefined) break;
    const trimmed = line.trim();
    if (FENCE.test(trimmed)) {
      fence = !fence;
      continue;
    }
    if (!fence && open.test(trimmed)) {
      start = i;
      break;
    }
  }
  if (start === -1) return "";

  let end = -1;
  fence = false;
  for (let i = start + 1; i < body.length; i++) {
    const line = body[i];
    if (line === undefined) break;
    const trimmed = line.trim();
    if (FENCE.test(trimmed)) {
      fence = !fence;
      continue;
    }
    if (!fence && close.test(trimmed)) {
      end = i;
      break;
    }
  }
  if (end === -1) return "";

  return body.slice(start + 1, end).join("\n");
};

export const parseCardsFromNotes = (notes: string): ParsedCard[] => {
  const lines = notes.split("\n");
  const getLine = (i: number) => lines[i];
  const cards: ParsedCard[] = [];

  let i = 0;
  let insideFence = false;
  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) break;
    const trimmed = line.trim();

    if (FENCE.test(trimmed)) {
      insideFence = !insideFence;
      i++;
      continue;
    }
    if (insideFence) {
      i++;
      continue;
    }

    const openMatch = trimmed.match(CARD_OPEN);
    if (!openMatch) {
      i++;
      continue;
    }

    const close = findCardClose(getLine, i + 1, lines.length);
    if (close === -1) {
      // Unterminated `<card>` — not a real block; treat the line as content.
      i++;
      continue;
    }

    const idMatch = (openMatch[1] ?? "").match(ID_ATTR);
    const body = lines.slice(i + 1, close);
    const clean = (raw: string) => stripBlankLineSentinel(raw).trim();
    cards.push({
      id: idMatch ? (idMatch[1] ?? null) : null,
      front: clean(extractSideRaw(body, "front")),
      back: clean(extractSideRaw(body, "back")),
    });
    i = close + 1;
  }

  return cards;
};

// Ensure every `<card>` block has a unique id: assign one to id-less cards and
// regenerate later duplicates. Returns the (possibly) rewritten notes so the
// caller can persist a stable document — otherwise the next parse would keep
// regenerating, churning rows. Fence-aware so `<card …>` shown inside a code
// block is left untouched.
export const normalizeCardIds = (
  notes: string,
): { notes: string; changed: boolean } => {
  const lines = notes.split("\n");
  const seen = new Set<string>();
  let changed = false;
  let insideFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) break;
    const trimmed = line.trim();
    if (FENCE.test(trimmed)) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) continue;

    const openMatch = trimmed.match(CARD_OPEN);
    if (!openMatch) continue;

    const idMatch = (openMatch[1] ?? "").match(ID_ATTR);
    const currentId = idMatch ? (idMatch[1] ?? null) : null;
    const needsNew = currentId === null || seen.has(currentId);
    const finalId = needsNew ? newCardId() : currentId;
    seen.add(finalId);

    if (needsNew) {
      lines[i] = line.replace(/<card\b[^>]*>/i, `<card id="${finalId}">`);
      changed = true;
    }
  }

  return { notes: changed ? lines.join("\n") : notes, changed };
};

// A standalone structural-tag line inside a card side would corrupt the block
// on the next parse (`</card>` would close the card early). Escape the `<`
// with a backslash — markdown renders it as the same literal text — exactly
// as the editor's serializer does for typed delimiter text.
const STRUCTURAL_LINE = /^<\/?(card|front|back)\b[^>]*>$/i;
const escapeStructuralLines = (text: string): string =>
  text
    .split("\n")
    .map((line) => (STRUCTURAL_LINE.test(line.trim()) ? `\\${line}` : line))
    .join("\n");

/**
 * Rewrite one `<card>` block's sides in a notes document, by id. Everything
 * outside the card — and the card's own open line, id included — is preserved
 * byte-for-byte; the body is rebuilt in canonical form. Fence-aware like every
 * other scanner here, so card-looking text inside code blocks is never
 * touched. Returns null when no card with that id exists (caller falls back
 * or surfaces the miss).
 */
export const replaceCardInNotes = (
  notes: string,
  cardId: string,
  front: string,
  back: string,
): string | null => {
  const lines = notes.split("\n");
  const getLine = (i: number) => lines[i];
  let insideFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) break;
    const trimmed = line.trim();
    if (FENCE.test(trimmed)) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) continue;

    const openMatch = trimmed.match(CARD_OPEN);
    if (!openMatch) continue;
    const close = findCardClose(getLine, i + 1, lines.length);
    if (close === -1) continue;

    const idMatch = (openMatch[1] ?? "").match(ID_ATTR);
    if (!idMatch || idMatch[1] !== cardId) {
      i = close;
      continue;
    }

    const body = [
      "<front>",
      escapeStructuralLines(front),
      "</front>",
      "<back>",
      escapeStructuralLines(back),
      "</back>",
    ];
    return [...lines.slice(0, i + 1), ...body, ...lines.slice(close)].join(
      "\n",
    );
  }

  return null;
};
