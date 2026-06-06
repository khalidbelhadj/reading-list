// Empty paragraphs have no representation in standard markdown — CommonMark
// collapses any run of blank lines into a single paragraph separator. To keep
// intentional blank lines alive across the storage round-trip, the notes /
// flashcard editor serializes each empty paragraph to a literal "&nbsp;" line
// (see ParagraphWithBlankLines in components/ui/markdown-editor.tsx); markdown-it
// parses it back into a paragraph on load.
//
// That sentinel is an internal storage device. It renders invisibly inside the
// editor, but leaks as literal text anywhere the stored markdown is exported as
// plain text (clipboard copy, Chat with Claude, etc.). Strip it at every such
// boundary via `stripBlankLineSentinel`.
export const BLANK_LINE_SENTINEL = "&nbsp;";

// "&nbsp;" contains no regex metacharacters, so it's safe to interpolate directly.
const SENTINEL_LINE = new RegExp(`^${BLANK_LINE_SENTINEL}$`, "gm");

export const stripBlankLineSentinel = (markdown: string): string =>
  markdown.replace(SENTINEL_LINE, "");
