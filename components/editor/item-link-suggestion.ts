import { type Editor, Extension } from "@tiptap/core";
import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// "@" mention detection for linking reading-list items inside the notes
// editor (Notion-style). Two plugins:
//
//   1. Suggestion state — watches the text before the caret for an "@query"
//      run and exposes {active, from, to, query} to the React dropdown
//      (components/editor/item-link-menu.tsx). The dropdown owns the item list,
//      filtering and selection; keystrokes it needs (arrows, Enter, Escape…)
//      are forwarded through `storage.onKeyDown` so they never reach the
//      editor while the menu is open.
//
//   2. Ghost text — an inline widget decoration after the caret completing
//      the highlighted item's title (type "@job", see " Applications 2024"
//      in faint text). The dropdown drives it via `itemLinkGhostKey` meta;
//      the plugin only stores {text, to} and draws the widget while the
//      suggestion is active at the same position.

export type ItemLinkSuggestionState = {
  active: boolean;
  // Position of the "@" character; the query runs from there to the caret.
  from: number;
  to: number;
  query: string;
  // "@" position of a suggestion dismissed with Escape — stays inactive until
  // the match at that position disappears (mapped through doc changes).
  dismissedFrom: number | null;
};

type GhostState = { text: string; to: number };

export type ItemLinkSuggestionStorage = {
  onKeyDown: ((event: KeyboardEvent) => boolean) | null;
};

// The dropdown (a React component) receives the keys the plugin forwards via
// this storage slot. A setter rather than a direct assignment in the component
// keeps react-compiler happy (no mutation of hook arguments in scope).
export const setItemLinkKeyHandler = (
  editor: Editor,
  handler: ItemLinkSuggestionStorage["onKeyDown"],
) => {
  const storage = (
    editor.storage as unknown as {
      itemLinkSuggestion: ItemLinkSuggestionStorage;
    }
  ).itemLinkSuggestion;
  storage.onKeyDown = handler;
};

export const itemLinkSuggestionKey = new PluginKey<ItemLinkSuggestionState>(
  "itemLinkSuggestion",
);
export const itemLinkGhostKey = new PluginKey<GhostState>("itemLinkGhost");

const INACTIVE: ItemLinkSuggestionState = {
  active: false,
  from: 0,
  to: 0,
  query: "",
  dismissedFrom: null,
};

// "@" at the start of a line or after whitespace, followed by a query that
// doesn't start with whitespace but may contain spaces ("@job applications").
// Anchored to the caret — editing in the middle of the query closes the menu,
// same as tiptap's own suggestion utility.
const SUGGESTION_RE = /(?:^|\s)@([^\s@][^@]*)?$/;

const findMatch = (
  state: EditorState,
): { from: number; to: number; query: string } | null => {
  const { $from, empty } = state.selection;
  if (!empty) return null;
  const parent = $from.parent;
  if (!parent.isTextblock || parent.type.spec.code) return null;
  if ($from.marks().some((mark) => mark.type.name === "code")) return null;
  // "\0" keeps offsets aligned (inline leaves are size 1) and can't collide
  // with typed text, so a leaf inside the query is detected and rejected.
  const textBefore = parent.textBetween(0, $from.parentOffset, "\0", "\0");
  const match = SUGGESTION_RE.exec(textBefore);
  if (!match) return null;
  const query = match[1] ?? "";
  if (query.length > 64 || query.includes("\0")) return null;
  const atOffset = match.index + (match[0].length - query.length - 1);
  return { from: $from.start() + atOffset, to: $from.pos, query };
};

export const ItemLinkSuggestion = Extension.create<
  Record<string, never>,
  ItemLinkSuggestionStorage
>({
  name: "itemLinkSuggestion",

  addStorage() {
    return { onKeyDown: null };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin<ItemLinkSuggestionState>({
        key: itemLinkSuggestionKey,
        state: {
          init: () => INACTIVE,
          apply: (tr, prev, _oldState, newState) => {
            const match = findMatch(newState);
            if (!match) return INACTIVE;
            let dismissedFrom = prev.dismissedFrom;
            if (dismissedFrom !== null && tr.docChanged) {
              dismissedFrom = tr.mapping.map(dismissedFrom);
            }
            if (tr.getMeta(itemLinkSuggestionKey) === "dismiss") {
              dismissedFrom = match.from;
            }
            if (dismissedFrom === match.from) {
              return { ...INACTIVE, dismissedFrom };
            }
            return { active: true, ...match, dismissedFrom: null };
          },
        },
        props: {
          handleKeyDown: (view, event) => {
            const state = itemLinkSuggestionKey.getState(view.state);
            if (!state?.active) return false;
            return storage.onKeyDown?.(event) ?? false;
          },
        },
      }),

      new Plugin<GhostState>({
        key: itemLinkGhostKey,
        state: {
          init: () => ({ text: "", to: 0 }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(itemLinkGhostKey) as GhostState | undefined;
            if (meta) return meta;
            if (!tr.docChanged) return prev;
            return { ...prev, to: tr.mapping.map(prev.to) };
          },
        },
        props: {
          decorations: (state) => {
            const suggestion = itemLinkSuggestionKey.getState(state);
            const ghost = itemLinkGhostKey.getState(state);
            if (!suggestion?.active || !ghost?.text) return DecorationSet.empty;
            // Stale-position guard: the dropdown re-dispatches after every doc
            // change (layout effect), but never draw a ghost somewhere it
            // wasn't asked for.
            if (ghost.to !== suggestion.to) return DecorationSet.empty;
            const widget = Decoration.widget(
              ghost.to,
              () => {
                const span = document.createElement("span");
                span.className = "item-link-ghost";
                span.textContent = ghost.text;
                return span;
              },
              { side: 1, key: `${ghost.to}:${ghost.text}` },
            );
            return DecorationSet.create(state.doc, [widget]);
          },
        },
      }),
    ];
  },
});
