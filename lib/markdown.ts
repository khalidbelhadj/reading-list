// Empty paragraphs have no representation in standard markdown — CommonMark
// collapses any run of blank lines into a single paragraph separator. To keep
// intentional blank lines alive across the storage round-trip, the notes /
// flashcard editor serializes each empty paragraph to a literal "&nbsp;" line
// (see ParagraphWithBlankLines in components/editor/markdown-editor.tsx); markdown-it
// parses it back into a paragraph on load.
//
// That sentinel is an internal storage device. It renders invisibly inside the
// editor, but leaks as literal text anywhere the stored markdown is exported as
// plain text (clipboard copy, Chat with Claude, etc.). Strip it at every such
// boundary via `stripBlankLineSentinel`.
export const BLANK_LINE_SENTINEL = "&nbsp;";

// The sentinel is written as the literal "&nbsp;" entity, but it round-trips
// through the editor as an actual non-breaking space (U+00A0): markdown-it
// decodes the entity on load, and re-serializing that paragraph emits the raw
// character rather than the entity. Match a line that is only the sentinel in
// either form so both generations are stripped wherever stored markdown leaks
// to plain text (clipboard, Chat with Claude, card parsing).
const SENTINEL_LINE = new RegExp("^[ \\t]*(?:&nbsp;|\\u00a0)[ \\t]*$", "gm");

export const stripBlankLineSentinel = (markdown: string): string =>
  markdown.replace(SENTINEL_LINE, "");
