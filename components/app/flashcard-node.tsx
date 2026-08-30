import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import {
  type Editor,
  mergeAttributes,
  Node,
  NodeViewContent,
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import type MarkdownIt from "markdown-it";

import { newCardId } from "@/lib/card-id";
import { extractSideRaw, findCardClose, ID_ATTR } from "@/lib/card-parse";

/**
 * The inline flashcard for the kit markdown editor, in the notes' `<card>`
 * format:
 *
 *   <card id="abc12345">
 *   <front>
 *   ...markdown...
 *   </front>
 *   <back>
 *   ...markdown...
 *   </back>
 *   </card>
 *
 * Parsing goes through lib/card-parse — the shared, fence-aware scanner also
 * used by the server-side notes→DB sync — so a literal `</card>` or `</front>`
 * inside a code block is content, never a delimiter, and structural tags only
 * match as standalone lines. Ids are constrained to newCardId()'s alphabet
 * before they are ever interpolated back into markdown or HTML, so a
 * hand-written `<card id='">…'>` can't smuggle markup through serialization.
 *
 * Styled as the Sheet flashcard (board round 10): quiet surface, front
 * medium, the back beneath a hairline. Pass `flashcardExtensions` to
 * MarkdownEditor's `extensions`.
 */

// Ids round-trip through markdown and DOM attributes; anything outside this
// alphabet is treated as absent (a fresh id is minted on serialize).
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const safeId = (id: unknown): string | null =>
  typeof id === "string" && SAFE_ID.test(id) ? id : null;

type SerializerState = {
  write: (text: string) => void;
  renderContent: (node: unknown) => void;
  closeBlock: (node: unknown) => void;
  ensureNewLine: () => void;
};

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    flashcardNode: {
      insertCard: () => ReturnType;
    };
  }
}

const cardMarkdownPlugin = (md: MarkdownIt) => {
  md.block.ruler.before(
    "html_block",
    "card",
    (state, startLine, endLine, silent) => {
      const lineAt = (index: number) => {
        const pos = (state.bMarks[index] ?? 0) + (state.tShift[index] ?? 0);
        return state.src.slice(pos, state.eMarks[index]);
      };

      const startContent = lineAt(startLine);
      if (!/^<card\b/i.test(startContent)) return false;

      // Find the real `</card>` line: standalone and outside any code fence
      // in the card body, so a `</card>` inside a code block doesn't close
      // the card early. See lib/card-parse.ts.
      const nextLine = findCardClose(lineAt, startLine + 1, endLine);
      if (nextLine === -1) return false;
      if (silent) return true;

      const body: string[] = [];
      for (let i = startLine + 1; i < nextLine; i++) body.push(lineAt(i));

      const idMatch = startContent.match(ID_ATTR);
      const id = safeId(idMatch?.[1]);
      const frontMd = extractSideRaw(body, "front").trim();
      const backMd = extractSideRaw(body, "back").trim();

      // Rendered through the same markdown-it instance, so side content gets
      // the exact same treatment as any other markdown; the ProseMirror
      // schema then keeps only nodes and attributes it knows.
      const frontHtml = md.render(frontMd);
      const backHtml = md.render(backMd);

      const token = state.push("html_block", "", 0);
      token.content =
        `<card${id ? ` id="${id}"` : ""}>` +
        `<front>${frontHtml}</front>` +
        `<back>${backHtml}</back>` +
        `</card>\n`;
      token.map = [startLine, nextLine + 1];

      state.line = nextLine + 1;
      return true;
    },
  );
};

// What a card side may contain: every block of the kit editor EXCEPT cards.
// A flashcard inside a flashcard is nonsense, so nesting is banned at the
// schema level — pasted or hand-written nested `<card>` markup is flattened
// to its inner blocks by ProseMirror, and insertCard refuses inside a card.
const SIDE_CONTENT =
  "(paragraph | heading | blockquote | bulletList | orderedList | taskList | codeBlock | horizontalRule | image | blockMath)+";

const CardView = ({ editor, node }: NodeViewProps) => (
  // data-card-id lets the item view scroll to a specific card (e.g. jumping
  // from a review card into the notes).
  <NodeViewWrapper
    className="x-card-node"
    data-card-id={(node.attrs.cardId as string | null) ?? undefined}
  >
    <NodeViewContent
      className="x-card"
      data-editable={editor.isEditable ? "" : undefined}
    />
  </NodeViewWrapper>
);

const FlashcardBlock = Node.create({
  name: "card",
  group: "block",
  content: "cardFront cardBack",
  defining: true,
  isolating: true,

  addNodeView() {
    return ReactNodeViewRenderer(CardView);
  },

  addAttributes() {
    return {
      cardId: {
        default: null,
        parseHTML: (el) => safeId(el.getAttribute("id")),
        renderHTML: (attrs) => {
          const id = safeId(attrs.cardId);
          return id ? { id } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "card" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["card", mergeAttributes(HTMLAttributes, { class: "x-card" }), 0];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: SerializerState,
          node: { attrs: { cardId?: string } },
        ) {
          // An id that fails the alphabet is replaced rather than emitted, so
          // the serialized attribute can never break out of its quotes or the
          // standalone `<card …>` line.
          const id = safeId(node.attrs.cardId) ?? newCardId();
          state.write(`<card id="${id}">\n`);
          state.renderContent(node);
          state.ensureNewLine();
          state.write(`</card>`);
          state.closeBlock(node);
        },
        parse: {
          setup(md: MarkdownIt) {
            md.use(cardMarkdownPlugin);
          },
        },
      },
    };
  },

  addCommands() {
    return {
      insertCard:
        () =>
        ({ chain, state }) => {
          // No cards inside cards.
          if (findAncestor(state.selection.$from, "card")) return false;
          const insertAt = state.selection.from;
          return chain()
            .insertContent({
              type: this.name,
              attrs: { cardId: newCardId() },
              content: [
                { type: "cardFront", content: [{ type: "paragraph" }] },
                { type: "cardBack", content: [{ type: "paragraph" }] },
              ],
            })
            .command(({ tr, dispatch }) => {
              if (!dispatch) return true;
              let cardStart = -1;
              tr.doc.nodesBetween(
                Math.max(0, insertAt - 1),
                tr.doc.content.size,
                (node, pos) => {
                  if (cardStart >= 0) return false;
                  if (node.type.name === "card") {
                    cardStart = pos;
                    return false;
                  }
                  return true;
                },
              );
              if (cardStart < 0) return true;
              // +1 enter card, +1 enter cardFront, +1 enter first paragraph
              dispatch(
                tr.setSelection(TextSelection.create(tr.doc, cardStart + 3)),
              );
              return true;
            })
            .focus()
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-c": () => this.editor.commands.insertCard(),
      Tab: ({ editor }) => moveWithinCard(editor as Editor, "forward"),
      "Shift-Tab": ({ editor }) => moveWithinCard(editor as Editor, "backward"),
      Enter: ({ editor }) => exitOnEmptyBackTrailing(editor as Editor),
      "Mod-Enter": ({ editor }) => exitCard(editor as Editor, "forward"),
      "Mod-Shift-Enter": ({ editor }) => exitCard(editor as Editor, "backward"),
      ArrowUp: ({ editor }) => escapeAtDocEdge(editor as Editor, "backward"),
      ArrowDown: ({ editor }) => escapeAtDocEdge(editor as Editor, "forward"),
      Backspace: ({ editor }) => escapeAtDocEdge(editor as Editor, "backward"),
    };
  },
});

type ResolvedPos = ReturnType<PMNode["resolve"]>;

const findAncestor = ($pos: ResolvedPos, name: string) => {
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === name) return { node, depth: d };
  }
  return null;
};

// Tab / Shift-Tab hop between the two sides; past either end they leave the
// card entirely.
const moveWithinCard = (editor: Editor, direction: "forward" | "backward") => {
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty) return false;

  const inSide =
    findAncestor($from, "cardFront") ?? findAncestor($from, "cardBack");
  if (!inSide) return false;

  const cardDepth = inSide.depth - 1;
  const cardNode = $from.node(cardDepth);
  if (cardNode.type.name !== "card") return false;
  const cardStart = $from.start(cardDepth);

  const sideIndex = $from.index(cardDepth);
  const targetIndex = direction === "forward" ? sideIndex + 1 : sideIndex - 1;

  if (targetIndex < 0 || targetIndex >= cardNode.childCount) {
    return exitCard(editor, direction);
  }

  let offset = 0;
  for (let i = 0; i < targetIndex; i++) offset += cardNode.child(i).nodeSize;
  const targetSide = cardNode.child(targetIndex);
  const sideContentStart = cardStart + offset + 1; // step into side
  const targetPos =
    direction === "forward"
      ? sideContentStart + 1 // start of first paragraph content
      : sideContentStart + targetSide.content.size - 1; // end of last paragraph

  const tr = state.tr.setSelection(TextSelection.create(state.doc, targetPos));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
};

// Arrow/Backspace at the very edge of a card that is also the edge of the
// document: step outside instead of being trapped.
const escapeAtDocEdge = (editor: Editor, direction: "forward" | "backward") => {
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty) return false;

  const sideName = direction === "backward" ? "cardFront" : "cardBack";
  const inSide = findAncestor($from, sideName);
  if (!inSide) return false;

  const cardDepth = inSide.depth - 1;
  const cardNode = $from.node(cardDepth);
  if (cardNode.type.name !== "card") return false;

  if (direction === "backward") {
    if ($from.parentOffset !== 0) return false;
    if ($from.index(inSide.depth) !== 0) return false;
    if ($from.before(cardDepth) !== 0) return false;
  } else {
    if ($from.parentOffset !== $from.parent.content.size) return false;
    if ($from.index(inSide.depth) !== inSide.node.childCount - 1) return false;
    if ($from.after(cardDepth) !== state.doc.content.size) return false;
  }

  return exitCard(editor, direction);
};

// Enter on the empty trailing paragraph of the back leaves the card, deleting
// that empty paragraph — typing flows naturally out of a finished card.
const exitOnEmptyBackTrailing = (editor: Editor) => {
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty) return false;
  const inBack = findAncestor($from, "cardBack");
  if (!inBack) return false;
  if ($from.parent.content.size !== 0) return false;
  const indexInBack = $from.index(inBack.depth);
  if (indexInBack !== inBack.node.childCount - 1) return false;
  return exitCard(editor, "forward", { trimEmpty: true });
};

const exitCard = (
  editor: Editor,
  direction: "forward" | "backward" = "forward",
  opts: { trimEmpty?: boolean } = {},
) => {
  const { state, schema } = editor;
  const { $from } = state.selection;
  const inCard = findAncestor($from, "card");
  if (!inCard) return false;
  const cardDepth = inCard.depth;
  const exitPos =
    direction === "forward" ? $from.after(cardDepth) : $from.before(cardDepth);

  const tr = state.tr;
  if (opts.trimEmpty) {
    tr.delete($from.before($from.depth), $from.after($from.depth));
  }

  const insertPos = tr.mapping.map(exitPos);
  const neighborBefore =
    insertPos > 0 ? tr.doc.resolve(insertPos).nodeBefore : null;
  const neighborAfter = tr.doc.resolve(insertPos).nodeAfter;
  const adjacentNode = direction === "forward" ? neighborAfter : neighborBefore;
  const needsParagraph = !adjacentNode || adjacentNode.type.name === "card";

  let selectionPos: number;
  if (needsParagraph) {
    const paragraphType = schema.nodes.paragraph;
    if (!paragraphType) return false;
    tr.insert(insertPos, paragraphType.create());
    selectionPos = insertPos + 1;
  } else if (direction === "forward") {
    selectionPos = insertPos + 1;
  } else {
    selectionPos = insertPos - 1;
  }

  tr.setSelection(TextSelection.create(tr.doc, selectionPos));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
};

const FlashcardFront = Node.create({
  name: "cardFront",
  content: SIDE_CONTENT,
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "front" }];
  },

  renderHTML() {
    return ["front", { class: "x-card-side x-card-front" }, 0];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: unknown) {
          state.write(`<front>\n`);
          state.renderContent(node);
          state.ensureNewLine();
          state.write(`</front>`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});

const FlashcardBack = Node.create({
  name: "cardBack",
  content: SIDE_CONTENT,
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "back" }];
  },

  renderHTML() {
    return ["back", { class: "x-card-side x-card-back" }, 0];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: unknown) {
          state.write(`<back>\n`);
          state.renderContent(node);
          state.ensureNewLine();
          state.write(`</back>`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});

// The set to hand MarkdownEditor's `extensions`.
export const flashcardExtensions = [
  FlashcardBlock,
  FlashcardFront,
  FlashcardBack,
];
