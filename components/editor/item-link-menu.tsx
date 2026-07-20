import { IconFileFilled } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { type Editor } from "@tiptap/react";
import React from "react";
import { createPortal } from "react-dom";

import {
  itemLinkGhostKey,
  itemLinkSuggestionKey,
  type ItemLinkSuggestionState,
  setItemLinkKeyHandler,
} from "@/components/editor/item-link-suggestion";
import { getFaviconSrc } from "@/components/items-list/utils";
import { Button } from "@/components/ui/button";
import { useAnchoredPopover } from "@/lib/editor/use-anchored-popover";
import { fetchItems } from "@/lib/queries";
import { type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

// The "@" dropdown for linking items (Notion-style): lists matching items,
// navigable with ↑/↓ and Ctrl+N/P, Enter/Tab (or click) inserts an itemLink
// node, Escape dismisses. Positioned at the "@" from ProseMirror coords and
// portaled to <body> so ProseMirror's DOM observer leaves it alone. Also
// drives the inline ghost completion for the highlighted item via the ghost
// plugin's meta (see item-link-suggestion.ts).

const MAX_RESULTS = 8;
const MENU_WIDTH = 288; // w-72
// Rough menu height for the flip-above-the-caret decision only; when flipped,
// the menu is bottom-anchored so the real height grows upward.
const ROW_HEIGHT = 26;
const CHROME_HEIGHT = 34;

const rankItems = (items: Item[], query: string): Item[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items.slice(0, MAX_RESULTS);
  const scored: { item: Item; score: number }[] = [];
  for (const item of items) {
    const title = item.title.toLowerCase();
    if (!title) continue;
    let score: number;
    if (title.startsWith(normalized)) {
      score = 0;
    } else {
      const index = title.indexOf(normalized);
      if (index === -1) continue;
      score = title[index - 1] === " " ? 1 : 2;
    }
    scored.push({ item, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, MAX_RESULTS).map((entry) => entry.item);
};

export const ItemLinkMenu = ({ editor }: { editor: Editor }) => {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  const [suggestion, setSuggestion] =
    React.useState<ItemLinkSuggestionState | null>(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const listRef = React.useRef<HTMLDivElement>(null);

  // Mirror the plugin state into React. The plugin returns a fresh state
  // object on every transaction while active, so caret movement re-renders
  // (and thus repositions) the menu.
  React.useEffect(() => {
    const update = () => {
      setSuggestion(itemLinkSuggestionKey.getState(editor.state) ?? null);
    };
    update();
    editor.on("transaction", update);
    return () => {
      editor.off("transaction", update);
    };
  }, [editor]);

  const active = suggestion?.active ?? false;
  const query = suggestion?.query ?? "";
  const suggestionTo = suggestion?.to ?? 0;

  const filtered = React.useMemo(
    () => (active && items ? rankItems(items, query) : []),
    [active, items, query],
  );

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query, active]);

  const clampedIndex = Math.min(
    selectedIndex,
    Math.max(0, filtered.length - 1),
  );
  const selectedItem = filtered[clampedIndex];

  const dismiss = React.useCallback(() => {
    if (editor.isDestroyed) return;
    editor.view.dispatch(
      editor.state.tr
        .setMeta(itemLinkSuggestionKey, "dismiss")
        .setMeta(itemLinkGhostKey, { text: "", to: 0 }),
    );
  }, [editor]);

  const accept = React.useCallback(
    (item: Item) => {
      const state = itemLinkSuggestionKey.getState(editor.state);
      if (!state?.active) return;
      editor
        .chain()
        .focus()
        .insertContentAt({ from: state.from, to: state.to }, [
          {
            type: "itemLink",
            attrs: { itemId: item.id, label: item.title.trim() || "Untitled" },
          },
          { type: "text", text: " " },
        ])
        .run();
    },
    [editor],
  );

  // Latest values for the keydown handler installed in the extension storage.
  const keyStateRef = React.useRef({ filtered, clampedIndex });
  keyStateRef.current = { filtered, clampedIndex };

  // Keys forwarded from the plugin's handleKeyDown while the suggestion is
  // active. stopPropagation keeps consumed keys from also triggering global
  // handlers (dismiss stack, list navigation).
  React.useEffect(() => {
    setItemLinkKeyHandler(editor, (event) => {
      const state = keyStateRef.current;
      if (event.key === "Escape") {
        event.stopPropagation();
        dismiss();
        return true;
      }
      if (state.filtered.length === 0) return false;
      const plainCtrl = event.ctrlKey && !event.metaKey && !event.altKey;
      const isNext =
        event.key === "ArrowDown" || (plainCtrl && event.key === "n");
      const isPrev =
        event.key === "ArrowUp" || (plainCtrl && event.key === "p");
      if (isNext || isPrev) {
        event.stopPropagation();
        const delta = isNext ? 1 : -1;
        setSelectedIndex(
          (state.clampedIndex + delta + state.filtered.length) %
            state.filtered.length,
        );
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = state.filtered[state.clampedIndex];
        if (!item) return false;
        event.stopPropagation();
        accept(item);
        return true;
      }
      return false;
    });
    return () => {
      setItemLinkKeyHandler(editor, null);
    };
  }, [editor, dismiss, accept]);

  // The sliding panel blurs the focused editor on Escape in a document-level
  // capture handler, which runs before ProseMirror's own keydown. While the
  // menu is open, Escape should close only the menu — window capture fires
  // even earlier, so consume it there.
  React.useEffect(() => {
    if (!active) return;
    const onKeyCapture = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    window.addEventListener("keydown", onKeyCapture, true);
    return () => window.removeEventListener("keydown", onKeyCapture, true);
  }, [active, dismiss]);

  // Close when the editor loses focus (row clicks preventDefault on mousedown,
  // so accepting an item never blurs).
  React.useEffect(() => {
    editor.on("blur", dismiss);
    return () => {
      editor.off("blur", dismiss);
    };
  }, [editor, dismiss]);

  // Ghost completion for the highlighted item: the remainder of its title when
  // the typed query is a prefix. Layout effect so the decoration lands in the
  // same frame as the keystroke that moved/changed it — no flicker.
  React.useLayoutEffect(() => {
    if (editor.isDestroyed) return;
    let text = "";
    if (active && query && selectedItem) {
      const title = selectedItem.title;
      if (
        title.length > query.length &&
        title.toLowerCase().startsWith(query.toLowerCase())
      ) {
        text = title.slice(query.length);
      }
    }
    const current = itemLinkGhostKey.getState(editor.state);
    if (current?.text === text && (!text || current.to === suggestionTo)) {
      return;
    }
    editor.view.dispatch(
      editor.state.tr.setMeta(itemLinkGhostKey, { text, to: suggestionTo }),
    );
  }, [editor, active, query, selectedItem, suggestionTo]);

  // Keep the highlighted row visible while navigating with the keyboard.
  React.useEffect(() => {
    listRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [clampedIndex, filtered]);

  // Anchored at the "@" (follows it on scroll/resize), clamped to the
  // viewport, flipping above the caret when it wouldn't fit below. Dismissal
  // is not the hook's job here — the suggestion plugin owns it (Escape via the
  // key handler, editor blur).
  const getAnchor = React.useCallback(() => {
    const from = suggestion?.active ? suggestion.from : null;
    if (from == null) return null;
    try {
      return editor.view.coordsAtPos(from);
    } catch {
      return null;
    }
  }, [editor, suggestion]);
  const estimateHeight = React.useCallback(
    () => CHROME_HEIGHT + Math.max(1, filtered.length) * ROW_HEIGHT,
    [filtered.length],
  );
  const { style } = useAnchoredPopover({
    open: active,
    getAnchor,
    width: MENU_WIDTH,
    estimateHeight,
  });

  if (!active || !suggestion || !items || !style) return null;

  return createPortal(
    <div
      style={style}
      className="z-50 flex w-72 flex-col rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
    >
      <div className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">
        Link to item
      </div>
      <div ref={listRef} className="flex max-h-56 flex-col overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-2 pb-1 text-xs text-muted-foreground/70">
            No matching items
          </div>
        ) : (
          filtered.map((item, index) => {
            const faviconSrc = getFaviconSrc(item);
            const isSelected = index === clampedIndex;
            return (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                size="sm"
                data-selected={isSelected || undefined}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => accept(item)}
                className={cn(
                  "h-6.5 shrink-0 justify-start gap-2 px-2 font-normal",
                  isSelected &&
                    "bg-muted text-foreground hover:bg-muted dark:bg-muted/50",
                )}
              >
                {faviconSrc ? (
                  <img
                    src={faviconSrc}
                    alt=""
                    className="size-3.5 shrink-0 rounded-xs"
                  />
                ) : (
                  <IconFileFilled className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">
                  {item.title.trim() || "Untitled"}
                </span>
              </Button>
            );
          })
        )}
      </div>
    </div>,
    document.body,
  );
};
