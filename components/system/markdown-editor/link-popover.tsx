import { IconExternalLink, IconPencil, IconX } from "@tabler/icons-react";
import { getMarkRange } from "@tiptap/core";
import { type Editor } from "@tiptap/react";
import React from "react";
import { createPortal } from "react-dom";

import { useAnchoredPopover } from "@/lib/editor/use-anchored-popover";

import { Button } from "../button";
import { Input } from "../input";
import { TextLink } from "../link";
import { Tooltip } from "../tooltip";
import { normalizeHref, preventBlur } from "./shared";

type LinkRange = { from: number; to: number };

const readLink = (editor: Editor, range: LinkRange) => {
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

// Click-driven link popover: clicking into a link opens it with the URL and
// an edit affordance; clicking the same link again just moves the caret; the
// caret merely passing through a link never opens it. Positioned from
// ProseMirror coords and portaled to <body> so ProseMirror's DOM observer
// leaves it alone.
export const LinkPopover = ({ editor }: { editor: Editor }) => {
  const [range, setRange] = React.useState<LinkRange | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [textValue, setTextValue] = React.useState("");
  const [urlValue, setUrlValue] = React.useState("");
  const rangeRef = React.useRef<LinkRange | null>(null);

  React.useEffect(() => {
    rangeRef.current = range;
  }, [range]);

  const close = React.useCallback(() => {
    rangeRef.current = null;
    setRange(null);
    setEditing(false);
  }, []);

  React.useEffect(() => {
    const dom = editor.view.dom;
    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || !dom.contains(anchor)) return close();
      const linkMark = editor.schema.marks.link;
      if (!linkMark) return close();
      const found = getMarkRange(
        editor.state.doc.resolve(editor.state.selection.from),
        linkMark,
      );
      if (!found) return close();
      const current = rangeRef.current;
      if (current && current.from === found.from && current.to === found.to)
        return close();
      const next = { from: found.from, to: found.to };
      rangeRef.current = next;
      setRange(next);
      setEditing(false);
    };
    dom.addEventListener("click", handleClick);
    return () => dom.removeEventListener("click", handleClick);
  }, [editor, close]);

  const getAnchor = React.useCallback(() => {
    if (!range) return null;
    try {
      return editor.view.coordsAtPos(range.from);
    } catch {
      return null;
    }
  }, [editor, range]);
  const isInsideEditor = React.useCallback(
    (target: Node) => editor.view.dom.contains(target),
    [editor],
  );
  const { popoverRef, style } = useAnchoredPopover({
    open: range !== null,
    getAnchor,
    width: editing ? 288 : 320,
    onDismiss: close,
    isInside: isInsideEditor,
  });

  const startEditing = React.useCallback(() => {
    if (!range) return;
    const { text, href } = readLink(editor, range);
    setTextValue(text);
    setUrlValue(href);
    setEditing(true);
  }, [editor, range]);

  const save = React.useCallback(() => {
    if (!range) return;
    const { from, to } = range;
    const href = normalizeHref(urlValue);
    if (!href) {
      editor.chain().focus().setTextSelection({ from, to }).unsetLink().run();
      close();
      return;
    }
    const text = textValue.trim() || href;
    const nextRange = { from, to: from + text.length };
    rangeRef.current = nextRange;
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
    setRange(nextRange);
    setEditing(false);
  }, [editor, range, textValue, urlValue, close]);

  const removeLink = React.useCallback(() => {
    if (!range) return;
    editor.chain().focus().setTextSelection(range).unsetLink().run();
    close();
  }, [editor, range, close]);

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

  if (!range || !style) return null;
  const { href } = readLink(editor, range);

  return createPortal(
    <div
      ref={popoverRef}
      style={style}
      className="glass z-50 rounded-control p-1 text-foreground"
    >
      {editing ? (
        <div className="flex w-70 flex-col gap-1.5 p-1">
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
          <div className="flex items-center justify-between pt-1">
            <Button
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
                variant="ghost"
                size="sm"
                onMouseDown={preventBlur}
                onClick={close}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
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
        <div className="flex items-center gap-0.5 pl-1.5">
          <TextLink
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            variant="accent"
            className="flex max-w-64 items-center gap-1 truncate text-small"
          >
            <IconExternalLink className="size-3 shrink-0" />
            <span className="truncate">{href}</span>
          </TextLink>
          <Tooltip content="Edit link">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit link"
              onMouseDown={preventBlur}
              onClick={startEditing}
            >
              <IconPencil />
            </Button>
          </Tooltip>
          <Tooltip content="Close">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              onMouseDown={preventBlur}
              onClick={close}
            >
              <IconX />
            </Button>
          </Tooltip>
        </div>
      )}
    </div>,
    document.body,
  );
};
