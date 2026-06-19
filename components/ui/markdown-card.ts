"use client";

import { Node, mergeAttributes, type Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import type MarkdownIt from "markdown-it";

import { newCardId as newId } from "@/lib/card-id";
import { extractSideRaw, findCardClose, ID_ATTR } from "@/lib/card-parse";

type SerializerState = {
  write: (text: string) => void;
  renderContent: (node: unknown) => void;
  closeBlock: (node: unknown) => void;
  ensureNewLine: () => void;
};

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    card: {
      insertCard: () => ReturnType;
    };
  }
}

export const cardMarkdownPlugin = (md: MarkdownIt) => {
  md.block.ruler.before(
    "html_block",
    "card",
    (state, startLine, endLine, silent) => {
      const lineAt = (index: number) => {
        const pos = state.bMarks[index] + state.tShift[index];
        return state.src.slice(pos, state.eMarks[index]);
      };

      const startContent = lineAt(startLine);
      if (!/^<card\b/i.test(startContent)) return false;

      // Find the real `</card>` line: standalone and outside any code fence in
      // the card body, so a `</card>` written inside a code block doesn't close
      // the block early (which would scatter content as orphaned markup). See
      // lib/card-parse.ts.
      const nextLine = findCardClose(lineAt, startLine + 1, endLine);
      if (nextLine === -1) return false;
      if (silent) return true;

      const body: string[] = [];
      for (let i = startLine + 1; i < nextLine; i++) body.push(lineAt(i));

      const idMatch = startContent.match(ID_ATTR);
      const id = idMatch ? idMatch[1] : "";
      const frontMd = extractSideRaw(body, "front").trim();
      const backMd = extractSideRaw(body, "back").trim();

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

export const Card = Node.create({
  name: "card",
  group: "block",
  content: "cardFront cardBack",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      cardId: {
        default: null,
        parseHTML: (el) => el.getAttribute("id"),
        renderHTML: (attrs) =>
          attrs.cardId ? { id: attrs.cardId as string } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "card" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "card",
      mergeAttributes(HTMLAttributes, { class: "card-block" }),
      0,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: SerializerState,
          node: { attrs: { cardId?: string } },
        ) {
          const id = node.attrs.cardId ?? newId();
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
          const insertAt = state.selection.from;
          return chain()
            .insertContent({
              type: this.name,
              attrs: { cardId: newId() },
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
      : sideContentStart + targetSide.content.size - 1; // end of last paragraph content

  const tr = state.tr.setSelection(TextSelection.create(state.doc, targetPos));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
};

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
    tr.insert(insertPos, schema.nodes.paragraph.create());
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

export const CardFront = Node.create({
  name: "cardFront",
  content: "block+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "front" }];
  },

  renderHTML() {
    return ["front", { class: "card-side card-front" }, 0];
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

export const CardBack = Node.create({
  name: "cardBack",
  content: "block+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "back" }];
  },

  renderHTML() {
    return ["back", { class: "card-side card-back" }, 0];
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
