import { InputRule } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Paragraph from "@tiptap/extension-paragraph";
import { type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { canJoin } from "@tiptap/pm/transform";
import { type Editor, Extension, ReactNodeViewRenderer } from "@tiptap/react";

import { BLANK_LINE_SENTINEL, stripBlankLineSentinel } from "@/lib/markdown";

import { CodeBlockNodeView } from "./code-block";

// Custom tiptap extensions behind the kit markdown editor (ported from
// lib/tiptap/extensions.ts); each one patches a
// specific ProseMirror/tiptap-markdown behavior gap (see the comment on each).

// ProseMirror's default Backspace at the start of the very first block does
// nothing — there's no previous block to merge with and the doc requires at
// least one child. When that first block is empty AND there's content below,
// drop it so the cursor lands at the start of the next block.
export const DeleteEmptyFirstBlock = Extension.create({
  name: "deleteEmptyFirstBlock",
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }: { editor: Editor }) => {
        const { state } = editor;
        const { selection, doc, tr } = state;
        const { $from, empty } = selection;
        if (!empty) return false;
        if ($from.depth !== 1) return false;
        if ($from.parentOffset !== 0) return false;
        if ($from.before(1) !== 0) return false;
        if ($from.parent.content.size !== 0) return false;
        if (doc.childCount < 2) return false;
        const end = $from.after(1);
        editor.view.dispatch(tr.delete(0, end).scrollIntoView());
        return true;
      },
    };
  },
});

// Browsers treat raw "\n" inside a contenteditable <pre> as part of one big
// "line" for selection movement, so macOS Ctrl-e/Ctrl-a and the Home/End keys
// skip to the bounds of the whole code block. Bind those keys to walk to the
// nearest "\n" (or block edge) manually so they behave per-line like
// everywhere else. Always consume the event — returning false would let the
// browser fall back to the broken native behavior.
export const CodeBlockWithLineNav = CodeBlockLowlight.extend({
  addNodeView() {
    // The language picker is portaled to <body> from the node view, so its
    // base-ui menu never touches the editor DOM — no stopEvent / ignoreMutation
    // overrides are needed. See components/editor/code-block-node-view.tsx.
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
  addKeyboardShortcuts() {
    const nodeType = this.type;
    const moveWithinCodeBlock = (
      direction: "lineStart" | "lineEnd",
      { editor }: { editor: Editor },
    ) => {
      const { selection } = editor.state;
      const { $from, empty } = selection;
      if (!empty || $from.parent.type !== nodeType) return false;
      const text = $from.parent.textContent;
      const offset = $from.parentOffset;
      let target: number;
      if (direction === "lineEnd") {
        const next = text.indexOf("\n", offset);
        target = next === -1 ? text.length : next;
      } else {
        const prev = text.lastIndexOf("\n", offset - 1);
        target = prev === -1 ? 0 : prev + 1;
      }
      if (target !== offset) {
        editor.commands.setTextSelection($from.start() + target);
      }
      return true;
    };
    const exitCodeBlock = (
      direction: "above" | "below",
      { editor }: { editor: Editor },
    ) => {
      const { $from, empty } = editor.state.selection;
      if (!empty || $from.parent.type !== nodeType) return false;
      const insertPos = direction === "above" ? $from.before() : $from.after();
      return editor
        .chain()
        .insertContentAt(insertPos, { type: "paragraph" })
        .setTextSelection(insertPos + 1)
        .run();
    };
    const insertIndent = ({ editor }: { editor: Editor }) => {
      // Tab indents within a code block (4 spaces) instead of moving focus out
      // of the editor. Handles a collapsed caret or a selection (replaced with
      // the indent); returns false elsewhere so Tab keeps its default behavior.
      // Insert a text node, not a plain string — tiptap parses a string as HTML
      // and collapses the leading spaces, so "    " would vanish.
      const { $from } = editor.state.selection;
      if ($from.parent.type !== nodeType) return false;
      return editor.commands.insertContent({ type: "text", text: "    " });
    };
    return {
      ...this.parent?.(),
      Tab: (props) => insertIndent(props),
      "Ctrl-e": (props) => moveWithinCodeBlock("lineEnd", props),
      End: (props) => moveWithinCodeBlock("lineEnd", props),
      "Ctrl-a": (props) => moveWithinCodeBlock("lineStart", props),
      Home: (props) => moveWithinCodeBlock("lineStart", props),
      "Mod-Shift-Enter": (props) => exitCodeBlock("above", props),
      "Mod-Enter": (props) => exitCodeBlock("below", props),
    };
  },
});

// tiptap-markdown serializes an empty paragraph to a blank line, and plain
// markdown collapses consecutive blank lines on re-parse — so a deliberate
// empty line between two paragraphs silently disappears on the next load. Emit
// a non-breaking space for empty paragraphs instead: markdown-it parses it back
// into a paragraph, so intentional blank lines survive the round-trip.
type MarkdownSerializeState = {
  write: (content: string) => void;
  closeBlock: (node: ProseMirrorNode) => void;
  renderInline: (node: ProseMirrorNode) => void;
};

export const ParagraphWithBlankLines = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializeState, node: ProseMirrorNode) {
          if (node.content.size === 0) {
            state.write(BLANK_LINE_SENTINEL);
            state.closeBlock(node);
            return;
          }
          state.renderInline(node);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});

// tiptap-markdown's `transformCopiedText` serializes the selection to markdown on
// copy, which emits the blank-line sentinel (see above) into the clipboard. Strip
// it here so every in-editor copy — notes or flashcards, anywhere the editor is
// used — yields clean markdown. Higher priority than the Markdown extension (50)
// so this clipboardTextSerializer wins over tiptap-markdown's.
type MarkdownSerializer = {
  markdown: {
    serializer: { serialize: (content: ProseMirrorNode["content"]) => string };
  };
};

export const CleanClipboardMarkdown = Extension.create({
  name: "cleanClipboardMarkdown",
  priority: 100,
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        props: {
          clipboardTextSerializer: (slice) => {
            const storage = editor.storage as unknown as MarkdownSerializer;
            return stripBlankLineSentinel(
              storage.markdown.serializer.serialize(slice.content),
            );
          },
        },
      }),
    ];
  },
});

// ProseMirror never merges two lists of the same type that end up adjacent —
// e.g. after splitting a list and deleting the paragraph between the halves.
// They stay as two `<ul>`/`<ol>` nodes instead of one continuous list. This
// appendTransaction joins any run of adjacent same-type lists (bullet, ordered,
// or task) back into a single list, so "break a list then join it" yields one
// list.
const LIST_TYPE_NAMES = new Set(["bulletList", "orderedList", "taskList"]);

export const JoinAdjacentLists = Extension.create({
  name: "joinAdjacentLists",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          // Only heal lists in response to real user edits. Programmatic
          // content loads use setContent({ emitUpdate: false }), which tags its
          // transaction `preventUpdate`; merging there would silently rewrite a
          // note's markdown (tight lists → loose) just from opening it.
          if (transactions.some((tr) => tr.getMeta("preventUpdate"))) {
            return null;
          }
          if (!transactions.some((tr) => tr.docChanged)) return null;

          // Collect each spot where a list is immediately followed by a
          // same-type list, at every depth (nested lists included). `boundary`
          // is the join position; `start`/`attrs` describe the first list so we
          // can restore its attributes (e.g. a bullet list's `tight` flag) onto
          // the merged node afterwards.
          const joins: {
            boundary: number;
            start: number;
            attrs: Record<string, unknown>;
          }[] = [];
          const scan = (node: ProseMirrorNode, contentStart: number) => {
            const children: { child: ProseMirrorNode; start: number }[] = [];
            node.forEach((child, offset) => {
              children.push({ child, start: contentStart + offset });
            });
            for (let i = 0; i < children.length - 1; i++) {
              const current = children[i];
              const next = children[i + 1];
              if (!current || !next) continue;
              if (
                LIST_TYPE_NAMES.has(current.child.type.name) &&
                current.child.type === next.child.type
              ) {
                joins.push({
                  boundary: current.start + current.child.nodeSize,
                  start: current.start,
                  attrs: current.child.attrs,
                });
              }
            }
            for (const { child, start } of children) {
              if (!child.isLeaf) scan(child, start + 1);
            }
          };
          scan(newState.doc, 0);
          if (joins.length === 0) return null;

          // Join from the last boundary backwards so each join's positions stay
          // valid as earlier joins shrink the document.
          joins.sort((a, b) => a.boundary - b.boundary);
          const tr = newState.tr;
          let joined = false;
          for (let i = joins.length - 1; i >= 0; i--) {
            const entry = joins[i];
            if (!entry || !canJoin(tr.doc, entry.boundary)) continue;
            tr.join(entry.boundary);
            // Keep the first list's attributes on the merged node — join can
            // otherwise reset flags like `tight`, turning a tight list loose.
            const merged = tr.doc.nodeAt(entry.start);
            if (merged) tr.setNodeMarkup(entry.start, undefined, entry.attrs);
            joined = true;
          }
          return joined ? tr : null;
        },
      }),
    ];
  },
});

// TipTap's built-in task-list rule only fires on a bare "[ ] " at the start of
// a line. People type the GFM form "- [ ] " out of habit, but the "- " triggers
// the bullet-list rule first, leaving the caret inside a bullet where the
// checkbox rule can't match. This rule fires on "[ ]"/"[x]" + space in either
// context: it lifts the item out of any surrounding bullet/ordered list (a no-op
// when there isn't one) and converts it to a task item, so both "- [ ] " and a
// bare "[ ] " produce a checklist. Higher priority than TaskList (100) so it
// wins over the built-in rule.
export const TaskListMarkdownShortcut = Extension.create({
  name: "taskListMarkdownShortcut",
  priority: 200,
  addInputRules() {
    return [
      new InputRule({
        find: /^\s*\[([ xX]?)\]\s$/,
        handler: ({ range, match, chain }) => {
          const checked = (match[1] ?? "").toLowerCase() === "x";
          chain()
            .deleteRange(range)
            .liftListItem("listItem")
            .toggleTaskList()
            .updateAttributes("taskItem", { checked })
            .run();
        },
      }),
    ];
  },
});
