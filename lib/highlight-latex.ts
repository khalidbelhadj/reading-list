import hljs from "highlight.js/lib/core";
import latex from "highlight.js/lib/languages/latex";

// A standalone highlight.js instance (separate from the lowlight one used for
// code blocks) with just the LaTeX grammar registered. Used to syntax-highlight
// the source field of the block-math editor. Emits the same `hljs-*` token
// classes already themed in app/globals.css.
hljs.registerLanguage("latex", latex);

export const highlightLatex = (code: string): string =>
  hljs.highlight(code, { language: "latex", ignoreIllegals: true }).value;
