import {
  IconCheck,
  IconChevronDown,
  IconLink,
  IconLinkOff,
} from "@tabler/icons-react";
import { type Editor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import React from "react";

import { cn } from "@/lib/utils";

import { Button } from "../button";
import {
  activeBlock,
  blockActions,
  markActions,
  selectFormatState,
} from "./actions";
import { normalizeHref, preventBlur } from "./shared";

// The formatting bubble that appears over a text selection: block type,
// marks, link. The block-type list opens inside the bubble rather than as a
// focus-stealing popup, so the editor selection (and the bubble) stays put.
export const FormatBubble = ({ editor }: { editor: Editor }) => {
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkValue, setLinkValue] = React.useState("");
  const [blockOpen, setBlockOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const blockRef = React.useRef<HTMLDivElement>(null);

  const state = useEditorState({ editor, selector: selectFormatState });

  React.useEffect(() => {
    setLinkOpen(false);
    setBlockOpen(false);
  }, [state.from, state.to]);

  React.useEffect(() => {
    if (linkOpen) inputRef.current?.focus();
  }, [linkOpen]);

  React.useEffect(() => {
    if (!blockOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (blockRef.current?.contains(event.target as Node)) return;
      setBlockOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBlockOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [blockOpen]);

  const marks = markActions(editor, state);
  const blocks = blockActions(editor, state);
  const current = activeBlock(blocks);

  const openLink = React.useCallback(() => {
    setLinkValue(state.href);
    setLinkOpen(true);
  }, [state.href]);

  const applyLink = React.useCallback(() => {
    const href = normalizeHref(linkValue);
    if (href)
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    else editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }, [editor, linkValue]);

  const removeLink = React.useCallback(() => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }, [editor]);

  const handleLinkKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyLink();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setLinkOpen(false);
        editor.chain().focus().run();
      }
    },
    [applyLink, editor],
  );

  const shouldShow = React.useCallback(
    ({ editor, state }: { editor: Editor; state: Editor["state"] }) => {
      if (!editor.isEditable) return false;
      const { selection } = state;
      if (selection.empty) return false;
      if (editor.isActive("codeBlock")) return false;
      return (
        state.doc.textBetween(selection.from, selection.to).trim().length > 0
      );
    },
    [],
  );

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="formatBubble"
      shouldShow={shouldShow}
      options={{ placement: "top", offset: 8 }}
      data-markdown-menu=""
      className="glass flex items-center gap-0.5 rounded-control p-1 text-foreground"
    >
      {linkOpen ? (
        <div className="flex items-center gap-0.5">
          {/* A bare input on purpose: the field lives inside the bubble and
              must not steal the editor's selection or add its own chrome. */}
          <input
            ref={inputRef}
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={handleLinkKeyDown}
            placeholder="Paste or type a link"
            className="h-6 w-56 bg-transparent px-2 text-body outline-none placeholder:text-muted-foreground"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Apply link"
            onMouseDown={preventBlur}
            onClick={applyLink}
          >
            <IconCheck />
          </Button>
          {state.link && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove link"
              onMouseDown={preventBlur}
              onClick={removeLink}
            >
              <IconLinkOff />
            </Button>
          )}
        </div>
      ) : (
        <>
          <div ref={blockRef} className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 px-1.5"
              aria-label="Block type"
              aria-expanded={blockOpen}
              onMouseDown={preventBlur}
              onClick={() => setBlockOpen((open) => !open)}
            >
              <current.Icon />
              {current.label}
              <IconChevronDown className="size-3 text-muted-foreground" />
            </Button>
            {blockOpen && (
              <div className="glass glass-solid absolute top-full left-0 z-50 mt-1 flex min-w-40 flex-col gap-px rounded-control p-1">
                {blocks.map(({ key, label, Icon, run }) => {
                  const isActive = key === current.key;
                  return (
                    <Button
                      key={key}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 justify-start gap-1.5 px-2 font-normal",
                        isActive && "bg-foreground/[0.07] text-foreground",
                      )}
                      onMouseDown={preventBlur}
                      onClick={() => {
                        run();
                        setBlockOpen(false);
                      }}
                    >
                      <Icon />
                      {label}
                      {isActive && (
                        <IconCheck className="ml-auto size-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mx-0.5 h-4 w-px bg-foreground/10" />
          {marks.map(({ key, label, Icon, active, run }) => (
            <Button
              key={key}
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              aria-pressed={active}
              onMouseDown={preventBlur}
              onClick={run}
              className={cn(active && "bg-foreground/[0.09] text-foreground")}
            >
              <Icon />
            </Button>
          ))}
          <div className="mx-0.5 h-4 w-px bg-foreground/10" />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Link"
            aria-pressed={state.link}
            onMouseDown={preventBlur}
            onClick={openLink}
            className={cn(state.link && "bg-foreground/[0.09] text-foreground")}
          >
            <IconLink />
          </Button>
        </>
      )}
    </BubbleMenu>
  );
};
