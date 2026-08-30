import "katex/dist/katex.min.css";

// Copied from components/editor/markdown-math.ts for the kit editor; the
// legacy editor keeps its own until it is deleted.
import { InputRule } from "@tiptap/core";
import {
  BlockMath as BaseBlockMath,
  InlineMath as BaseInlineMath,
} from "@tiptap/extension-mathematics";
import { NodeSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { KatexOptions } from "katex";
import type MarkdownIt from "markdown-it";

import { BlockMathNodeView } from "./block-math";
import { InlineMathNodeView } from "./inline-math";

// LaTeX support. The official @tiptap/extension-mathematics gives us the KaTeX
// rendering, node views, click-to-edit, and parseHTML/renderHTML for the
// `inlineMath` (span[data-type="inline-math"]) and `blockMath`
// (div[data-type="block-math"]) nodes — each stores its source in a `latex`
// attribute. Two things it does NOT give us, which we add here:
//
//   1. The package's built-in input rules use non-standard delimiters
//      ($$…$$ for inline, $$$…$$$ for block), so we override them to the
//      conventional $…$ (inline) / $$…$$ (block).
//   2. This app persists content as markdown (round-tripped through
//      tiptap-markdown / markdown-it), not ProseMirror JSON. The package has no
//      tiptap-markdown integration, so we add `storage.markdown.serialize`
//      (node → $…$ text) plus a `parse.setup` markdown-it plugin (stored $…$
//      text → math node on load), exactly as components/editor/markdown-card.ts
//      does for the card block.

const katexOptions: KatexOptions = { throwOnError: false, strict: false };

// Distinguish inline math from currency the way markdown-it-texmath does:
// real math never has whitespace hugging the delimiters ($x$, not $ x$), while
// prose currency always does across the pair ("$100 and $50" — the closing `$`
// has a space before it). Requiring non-space on both inner edges leaves prices
// as plain text without banning math that merely starts with a digit ($2x+1$).
const isWhitespace = (code: number) =>
  code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;

const escapeAttribute = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type SerializerState = {
  write: (text: string) => void;
  ensureNewLine: () => void;
  closeBlock: (node: unknown) => void;
};

type MathNode = { attrs: { latex?: string } };

// markdown-it inline rule: `$…$` → an empty inline-math placeholder span. With
// Markdown.configure({ html: true }) the span passes through to tiptap's HTML
// parser, where InlineMath.parseHTML turns it back into an `inlineMath` node.
// Code spans are tokenized earlier (the `backticks` rule), so a `$` inside
// `code` is never seen here.
const inlineMathRule = (md: MarkdownIt) => {
  md.inline.ruler.after("escape", "inlineMath", (state, silent) => {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 0x24 /* $ */) return false;
    // Defer to the block rule / avoid `$$` so display math isn't half-eaten.
    if (state.src.charCodeAt(start + 1) === 0x24) return false;
    // No space right after the opening `$` (rules out "$ x$" and currency).
    if (isWhitespace(state.src.charCodeAt(start + 1))) return false;

    let pos = start + 1;
    let close = -1;
    while (pos < state.posMax) {
      const code = state.src.charCodeAt(pos);
      if (code === 0x5c /* \ */) {
        pos += 2; // an escaped char (e.g. \$) can't close the run
        continue;
      }
      if (code === 0x24) {
        close = pos;
        break;
      }
      pos += 1;
    }
    if (close < 0) return false;
    // No space right before the closing `$` (rules out "…and $50").
    if (isWhitespace(state.src.charCodeAt(close - 1))) return false;

    const latex = state.src.slice(start + 1, close).trim();
    if (latex === "") return false;

    if (!silent) {
      const token = state.push("html_inline", "", 0);
      token.content = `<span data-type="inline-math" data-latex="${escapeAttribute(
        latex,
      )}"></span>`;
    }
    state.pos = close + 1;
    return true;
  });
};

// markdown-it block rule: a line opening with `$$` (one-liner `$$ x $$` or a
// fenced block closed by a line ending in `$$`) → a block-math placeholder div.
// Registered before `paragraph` but after `fence`/`code`, so `$$` inside a
// fenced or indented code block stays literal.
const blockMathRule = (md: MarkdownIt) => {
  md.block.ruler.before(
    "paragraph",
    "blockMath",
    (state, startLine, endLine, silent) => {
      const open =
        (state.bMarks[startLine] ?? 0) + (state.tShift[startLine] ?? 0);
      const openText = state.src.slice(open, state.eMarks[startLine]);
      if (!openText.startsWith("$$")) return false;

      const pushBlock = (latex: string, lastLine: number) => {
        const token = state.push("html_block", "", 0);
        token.content = `<div data-type="block-math" data-latex="${escapeAttribute(
          latex,
        )}"></div>\n`;
        token.map = [startLine, lastLine];
        state.line = lastLine;
      };

      // Single line: `$$ … $$` with content between the delimiters.
      const afterOpen = openText.slice(2).trimEnd();
      if (afterOpen.endsWith("$$")) {
        const inner = afterOpen.slice(0, -2).trim();
        if (inner !== "") {
          if (silent) return true;
          pushBlock(inner, startLine + 1);
          return true;
        }
      }

      // Fenced: open line is `$$`, scan until a line ending in `$$`.
      const buffer: string[] = [];
      const firstLine = openText.slice(2).trim();
      if (firstLine !== "") buffer.push(firstLine);

      let nextLine = startLine;
      let closed = false;
      while (nextLine + 1 < endLine) {
        nextLine += 1;
        const lineStart =
          (state.bMarks[nextLine] ?? 0) + (state.tShift[nextLine] ?? 0);
        const lineText = state.src
          .slice(lineStart, state.eMarks[nextLine])
          .trimEnd();
        if (lineText.endsWith("$$")) {
          const inner = lineText.slice(0, -2).trim();
          if (inner !== "") buffer.push(inner);
          closed = true;
          break;
        }
        buffer.push(state.src.slice(lineStart, state.eMarks[nextLine]));
      }
      if (!closed) return false;

      const latex = buffer.join("\n").trim();
      if (latex === "") return false;
      if (silent) return true;
      pushBlock(latex, nextLine + 1);
      return true;
    },
  );
};

export const InlineMath = BaseInlineMath.configure({ katexOptions }).extend({
  // Custom node view: renders KaTeX inline and opens a popover source editor
  // when selected/clicked/Tabbed into. `stopEvent` lets the node view own its
  // clicks (otherwise ProseMirror places a text selection instead of opening).
  addNodeView() {
    return ReactNodeViewRenderer(InlineMathNodeView, {
      as: "span",
      stopEvent: () => true,
    });
  },

  // Tab focuses an inline equation the caret is sitting next to (or that's
  // already node-selected) by selecting it — the node view opens on selection.
  // Falls through (returns false) everywhere else so Tab keeps its behavior.
  addKeyboardShortcuts() {
    const type = this.type;
    return {
      Tab: ({ editor }) => {
        const { selection } = editor.state;
        if (
          selection instanceof NodeSelection &&
          selection.node.type === type
        ) {
          return true;
        }
        const { $from, empty } = selection;
        if (!empty) return false;
        if ($from.nodeAfter?.type === type) {
          return editor.commands.setNodeSelection($from.pos);
        }
        if ($from.nodeBefore?.type === type) {
          return editor.commands.setNodeSelection(
            $from.pos - $from.nodeBefore.nodeSize,
          );
        }
        return false;
      },
    };
  },

  // Override the package's $$…$$ rule with the conventional single-dollar form.
  // Fires when the closing `$` is typed; skips currency and `$$` (block) runs.
  addInputRules() {
    const type = this.type;
    return [
      new InputRule({
        // Single `$…$`: no `$` before the opener, no `$` inside the content
        // (so a half-typed block `$$x$` can't trip this), and no whitespace
        // hugging the delimiters — same currency-vs-math rule as the parser.
        find: /(?<!\$)\$([^\s$](?:[^$\n]*[^\s$])?)\$$/,
        handler: ({ state, range, match }) => {
          const latex = (match[1] ?? "").trim();
          if (latex === "") return null;
          state.tr.replaceWith(range.from, range.to, type.create({ latex }));
        },
      }),
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: MathNode) {
          state.write(`$${node.attrs.latex ?? ""}$`);
        },
        parse: { setup: inlineMathRule },
      },
    };
  },
});

export const BlockMath = BaseBlockMath.configure({ katexOptions }).extend({
  // Swap the package's static atom renderer for the Obsidian-style live-preview
  // node view (editable LaTeX source + rendered equation beneath). `stopEvent`
  // hands all in-view events to the node view's own React handlers — without it
  // ProseMirror preempts a click on the rendered equation (a non-input element)
  // and places a text selection instead of letting us open the editor.
  addNodeView() {
    return ReactNodeViewRenderer(BlockMathNodeView, { stopEvent: () => true });
  },

  // Pressing Enter on a line that is just `$$` creates an empty equation and
  // opens it for editing (the block node view auto-focuses an empty block on
  // mount) — the `$$` + Enter flow from Obsidian. Falls through otherwise.
  addKeyboardShortcuts() {
    const type = this.type;
    return {
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || !$from.parent.isTextblock) return false;
        if ($from.parent.textContent !== "$$") return false;
        return editor
          .chain()
          .command(({ tr }) => {
            tr.replaceWith($from.before(), $from.after(), type.create());
            return true;
          })
          .run();
      },
    };
  },

  // A fully formed `$$…$$` on a line (e.g. inserted or pasted as plain text) is
  // converted to a block node in place.
  addInputRules() {
    const type = this.type;
    return [
      new InputRule({
        find: /^\$\$([^$\n]+)\$\$$/,
        handler: ({ state, range, match }) => {
          const latex = (match[1] ?? "").trim();
          if (latex === "") return null;
          const { tr } = state;
          const $from = state.doc.resolve(range.from);
          const node = type.create({ latex });
          const consumesHostTextblock =
            $from.depth > 0 &&
            $from.parent.isTextblock &&
            range.from === $from.start() &&
            range.to === $from.end();
          const canReplaceHostTextblock =
            consumesHostTextblock &&
            $from
              .node(-1)
              .canReplaceWith($from.index(-1), $from.indexAfter(-1), type);
          const at = canReplaceHostTextblock
            ? { from: $from.before(), to: $from.after() }
            : range;
          tr.replaceWith(at.from, at.to, node);
        },
      }),
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: MathNode) {
          // An abandoned empty block has no markdown representation — skip it.
          const latex = node.attrs.latex ?? "";
          if (latex.trim() === "") return;
          state.write(`$$\n${latex}\n$$`);
          state.closeBlock(node);
        },
        parse: { setup: blockMathRule },
      },
    };
  },
});
