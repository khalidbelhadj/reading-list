import { IconExternalLink, IconPencil, IconX } from "@tabler/icons-react";
import { getMarkRange } from "@tiptap/core";
import { type Editor } from "@tiptap/react";
import React from "react";
import { createPortal } from "react-dom";

import { normalizeHref, preventBlur } from "@/components/editor/editor-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAnchoredPopover } from "@/lib/editor/use-anchored-popover";

// The click-driven link popover for the markdown editor (MarkdownLinkMenu).
// Lives apart from the bubble menu: it's manually positioned from ProseMirror
// coords rather than a BubbleMenu, and shares only the editor-shared helpers.

const LinkMenuButton = ({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onMouseDown={preventBlur}
          onClick={onClick}
        />
      }
    >
      {children}
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

type LinkRange = { from: number; to: number };

const readLinkInfo = (editor: Editor, range: LinkRange) => {
  const text = editor.state.doc.textBetween(range.from, range.to);
  let href = "";
  editor.state.doc.nodesBetween(range.from, range.to, (node) => {
    if (href) return false;
    const mark = node.marks.find((m) => m.type.name === "link");
    if (mark) href = mark.attrs.href as string;
    return true;
  });
  return { text, href };
};

// A click-driven link popover (Slack-style): clicking *into* a link opens it,
// clicking the same link again just moves the caret and dismisses it, and the
// caret merely passing through a link (typing, arrow keys) never opens it. The
// popover surfaces the URL — clickable to open in a new tab — with an edit
// affordance that swaps it into a text/URL editor in place. Positioned manually
// from ProseMirror coords (not a BubbleMenu) so visibility is purely click-state
// driven, and portaled to <body> so ProseMirror's DOM observer leaves it alone.
export const MarkdownLinkMenu = ({ editor }: { editor: Editor }) => {
  const [activeLinkRange, setActiveLinkRange] =
    React.useState<LinkRange | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [textValue, setTextValue] = React.useState("");
  const [urlValue, setUrlValue] = React.useState("");
  const activeLinkRangeRef = React.useRef<LinkRange | null>(null);

  React.useEffect(() => {
    activeLinkRangeRef.current = activeLinkRange;
  }, [activeLinkRange]);

  const close = React.useCallback(() => {
    activeLinkRangeRef.current = null;
    setActiveLinkRange(null);
    setEditing(false);
  }, []);

  // Open / toggle the popover when a link in the editor is clicked.
  React.useEffect(() => {
    const dom = editor.view.dom;
    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || !dom.contains(anchor)) {
        close();
        return;
      }
      const linkMark = editor.schema.marks.link;
      if (!linkMark) {
        close();
        return;
      }
      const range = getMarkRange(
        editor.state.doc.resolve(editor.state.selection.from),
        linkMark,
      );
      if (!range) {
        close();
        return;
      }
      const current = activeLinkRangeRef.current;
      // Second click on the already-open link → just place the caret, no popover.
      if (current && current.from === range.from && current.to === range.to) {
        close();
        return;
      }
      const next = { from: range.from, to: range.to };
      activeLinkRangeRef.current = next;
      setActiveLinkRange(next);
      setEditing(false);
    };
    dom.addEventListener("click", handleClick);
    return () => dom.removeEventListener("click", handleClick);
  }, [editor, close]);

  // Positioned below the link's start, clamped to the viewport; closes on
  // Escape or a mousedown outside both the popover and the editor (clicks in
  // the editor are handled by the link-click effect above).
  const getAnchor = React.useCallback(() => {
    if (!activeLinkRange) return null;
    try {
      return editor.view.coordsAtPos(activeLinkRange.from);
    } catch {
      return null;
    }
  }, [editor, activeLinkRange]);
  const isInsideEditor = React.useCallback(
    (target: Node) => editor.view.dom.contains(target),
    [editor],
  );
  const { popoverRef, style } = useAnchoredPopover({
    open: activeLinkRange !== null,
    getAnchor,
    width: editing ? 288 : 320,
    onDismiss: close,
    isInside: isInsideEditor,
  });

  const startEditing = React.useCallback(() => {
    if (!activeLinkRange) return;
    const { text, href } = readLinkInfo(editor, activeLinkRange);
    setTextValue(text);
    setUrlValue(href);
    setEditing(true);
  }, [editor, activeLinkRange]);

  const save = React.useCallback(() => {
    if (!activeLinkRange) return;
    const { from, to } = activeLinkRange;
    const href = normalizeHref(urlValue);
    if (!href) {
      editor.chain().focus().setTextSelection({ from, to }).unsetLink().run();
      close();
      return;
    }
    const text = textValue.trim() || href;
    const nextRange = { from, to: from + text.length };
    // Keep the ref in sync *before* dispatching so the selectionUpdate fired by
    // this transaction doesn't see the caret land outside the stale range.
    activeLinkRangeRef.current = nextRange;
    editor
      .chain()
      .focus()
      .command(({ tr, state }) => {
        const linkMark = state.schema.marks.link;
        if (!linkMark) return false;
        tr.insertText(text, from, to);
        tr.addMark(from, from + text.length, linkMark.create({ href }));
        return true;
      })
      .setTextSelection(from + text.length)
      .run();
    setActiveLinkRange(nextRange);
    setEditing(false);
  }, [editor, activeLinkRange, textValue, urlValue, close]);

  const removeLink = React.useCallback(() => {
    if (!activeLinkRange) return;
    const { from, to } = activeLinkRange;
    editor.chain().focus().setTextSelection({ from, to }).unsetLink().run();
    close();
  }, [editor, activeLinkRange, close]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        save();
      } else if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    },
    [save, close],
  );

  if (!activeLinkRange || !style) return null;

  const { href } = readLinkInfo(editor, activeLinkRange);

  return createPortal(
    <div
      ref={popoverRef}
      style={style}
      className="z-50 rounded-lg border border-border bg-popover p-0.5 text-popover-foreground shadow-sm"
    >
      {editing ? (
        <div className="flex w-72 flex-col gap-1 p-1">
          <Input
            autoFocus
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Text"
          />
          <Input
            value={urlValue}
            onChange={(event) => setUrlValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Link"
          />
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onMouseDown={preventBlur}
              onClick={removeLink}
            >
              Remove
            </Button>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onMouseDown={preventBlur}
                onClick={close}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onMouseDown={preventBlur}
                onClick={save}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 pl-1">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex max-w-[16rem] items-center gap-1 truncate text-xs text-primary underline-offset-2 hover:underline"
          >
            <IconExternalLink className="size-3 shrink-0" />
            <span className="truncate">{href}</span>
          </a>
          <LinkMenuButton label="Edit link" onClick={startEditing}>
            <IconPencil />
          </LinkMenuButton>
          <LinkMenuButton label="Close" onClick={close}>
            <IconX />
          </LinkMenuButton>
        </div>
      )}
    </div>,
    document.body,
  );
};
