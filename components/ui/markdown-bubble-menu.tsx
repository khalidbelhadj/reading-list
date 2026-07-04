import React from "react";
import { createPortal } from "react-dom";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState, type Editor } from "@tiptap/react";
import { getMarkRange } from "@tiptap/core";
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrikethrough,
  IconCode,
  IconLink,
  IconLinkOff,
  IconCheck,
  IconPencil,
  IconExternalLink,
  IconX,
  IconChevronDown,
  IconPilcrow,
  IconH1,
  IconH2,
  IconH3,
  IconBlockquote,
  IconList,
  IconListNumbers,
  IconListCheck,
  IconSourceCode,
  type IconProps,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const preventBlur = (event: React.MouseEvent) => {
  // Keep the editor selection alive when a toolbar control is pressed.
  event.preventDefault();
};

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

type MarkAction = {
  key: string;
  label: string;
  Icon: React.ComponentType<IconProps>;
  active: boolean;
  run: () => void;
};

type BlockAction = {
  key: string;
  label: string;
  Icon: React.ComponentType<IconProps>;
  active: boolean;
  run: () => void;
};

// Prepend a protocol when the user types a bare host so the saved href is a
// valid absolute URL. Leaves mailto:, anchors and already-qualified URLs alone.
const normalizeHref = (raw: string) => {
  const href = raw.trim();
  if (!href) return "";
  if (/^(https?:\/\/|mailto:|#|\/)/i.test(href)) return href;
  return `https://${href}`;
};

export const MarkdownBubbleMenu = ({ editor }: { editor: Editor }) => {
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkValue, setLinkValue] = React.useState("");
  const [blockMenuOpen, setBlockMenuOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const blockMenuRef = React.useRef<HTMLDivElement>(null);

  const editorState = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      code: editor.isActive("code"),
      link: editor.isActive("link"),
      href: (editor.getAttributes("link").href as string | undefined) ?? "",
      paragraph: editor.isActive("paragraph"),
      heading1: editor.isActive("heading", { level: 1 }),
      heading2: editor.isActive("heading", { level: 2 }),
      heading3: editor.isActive("heading", { level: 3 }),
      blockquote: editor.isActive("blockquote"),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      taskList: editor.isActive("taskList"),
      codeBlock: editor.isActive("codeBlock"),
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    }),
  });

  // Collapse the link editor and block-type menu whenever the selection moves,
  // so neither lingers over a different range than the one it was opened for.
  React.useEffect(() => {
    setLinkOpen(false);
    setBlockMenuOpen(false);
  }, [editorState.from, editorState.to]);

  React.useEffect(() => {
    if (linkOpen) inputRef.current?.focus();
  }, [linkOpen]);

  // Close the block-type menu on Escape or a pointer press anywhere outside it
  // (the trigger lives inside blockMenuRef, so its own clicks are ignored here
  // and handled by the toggle). The menu renders inside the bubble rather than a
  // focus-stealing popup, so the editor selection — and thus the bubble — stays
  // put while it's open.
  React.useEffect(() => {
    if (!blockMenuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (blockMenuRef.current?.contains(event.target as Node)) return;
      setBlockMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBlockMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [blockMenuOpen]);

  const actions: MarkAction[] = [
    {
      key: "bold",
      label: "Bold",
      Icon: IconBold,
      active: editorState.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      key: "italic",
      label: "Italic",
      Icon: IconItalic,
      active: editorState.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      key: "underline",
      label: "Underline",
      Icon: IconUnderline,
      active: editorState.underline,
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      key: "strike",
      label: "Strikethrough",
      Icon: IconStrikethrough,
      active: editorState.strike,
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      key: "code",
      label: "Code",
      Icon: IconCode,
      active: editorState.code,
      run: () => editor.chain().focus().toggleCode().run(),
    },
  ];

  const textAction: BlockAction = {
    key: "paragraph",
    label: "Text",
    Icon: IconPilcrow,
    active: editorState.paragraph,
    run: () => editor.chain().focus().setParagraph().run(),
  };

  const blockActions: BlockAction[] = [
    textAction,
    {
      key: "heading1",
      label: "Heading 1",
      Icon: IconH1,
      active: editorState.heading1,
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      key: "heading2",
      label: "Heading 2",
      Icon: IconH2,
      active: editorState.heading2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      key: "heading3",
      label: "Heading 3",
      Icon: IconH3,
      active: editorState.heading3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      key: "blockquote",
      label: "Quote",
      Icon: IconBlockquote,
      active: editorState.blockquote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      key: "bulletList",
      label: "Bullet list",
      Icon: IconList,
      active: editorState.bulletList,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: "orderedList",
      label: "Numbered list",
      Icon: IconListNumbers,
      active: editorState.orderedList,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      key: "taskList",
      label: "Checklist",
      Icon: IconListCheck,
      active: editorState.taskList,
      run: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      key: "codeBlock",
      label: "Code block",
      Icon: IconSourceCode,
      active: editorState.codeBlock,
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
  ];
  // A list item / blockquote wraps a paragraph, so "paragraph" reads as active
  // inside them too. Prefer the more specific container and treat "Text" purely
  // as the fallback when nothing more specific matches.
  const activeBlock =
    blockActions.find((block) => block.key !== "paragraph" && block.active) ??
    textAction;

  const openLinkEditor = React.useCallback(() => {
    setLinkValue(editorState.href);
    setLinkOpen(true);
  }, [editorState.href]);

  const applyLink = React.useCallback(() => {
    const href = normalizeHref(linkValue);
    if (href) {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
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
      // No formatting marks apply inside code blocks.
      if (editor.isActive("codeBlock")) return false;
      // Hide for node selections (e.g. an image) — there's no text to format.
      return (
        state.doc.textBetween(selection.from, selection.to).trim().length > 0
      );
    },
    [],
  );

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="formatMenu"
      shouldShow={shouldShow}
      options={{ placement: "top", offset: 8 }}
      className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 text-popover-foreground shadow-sm"
    >
      {linkOpen ? (
        <div className="flex items-center gap-0.5">
          <input
            ref={inputRef}
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={handleLinkKeyDown}
            placeholder="Paste or type a link…"
            className="h-6 w-52 bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Apply link"
            onMouseDown={preventBlur}
            onClick={applyLink}
          >
            <IconCheck />
          </Button>
          {editorState.link && (
            <Button
              type="button"
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
          <div ref={blockMenuRef} className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 px-1.5"
              aria-label="Block type"
              aria-expanded={blockMenuOpen}
              onMouseDown={preventBlur}
              onClick={() => setBlockMenuOpen((open) => !open)}
            >
              <activeBlock.Icon />
              {activeBlock.label}
              <IconChevronDown className="size-3 text-muted-foreground" />
            </Button>
            {blockMenuOpen && (
              <div className="absolute top-full left-0 z-50 mt-1 flex min-w-40 flex-col gap-px rounded-lg bg-popover p-1 text-popover-foreground shadow-sm ring-1 ring-foreground/10">
                {blockActions.map(({ key, label, Icon, run }) => {
                  const isActive = key === activeBlock.key;
                  return (
                    <Button
                      key={key}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 justify-start gap-1.5 px-2 font-normal",
                        isActive && "bg-accent text-accent-foreground",
                      )}
                      onMouseDown={preventBlur}
                      onClick={() => {
                        run();
                        setBlockMenuOpen(false);
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
          <div className="mx-0.5 h-4 w-px bg-border" />
          {actions.map(({ key, label, Icon, active, run }) => (
            <Button
              key={key}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              aria-pressed={active}
              onMouseDown={preventBlur}
              onClick={run}
              className={cn(
                active &&
                  "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon />
            </Button>
          ))}
          <div className="mx-0.5 h-4 w-px bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Link"
            aria-pressed={editorState.link}
            onMouseDown={preventBlur}
            onClick={openLinkEditor}
            className={cn(
              editorState.link &&
                "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <IconLink />
          </Button>
        </>
      )}
    </BubbleMenu>
  );
};

type OpenLink = { from: number; to: number };

const readLinkInfo = (editor: Editor, range: OpenLink) => {
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
  const [open, setOpen] = React.useState<OpenLink | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [textValue, setTextValue] = React.useState("");
  const [urlValue, setUrlValue] = React.useState("");
  const [, bumpPosition] = React.useReducer((tick: number) => tick + 1, 0);
  const openRef = React.useRef<OpenLink | null>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  const close = React.useCallback(() => {
    openRef.current = null;
    setOpen(null);
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
      const current = openRef.current;
      // Second click on the already-open link → just place the caret, no popover.
      if (current && current.from === range.from && current.to === range.to) {
        close();
        return;
      }
      const next = { from: range.from, to: range.to };
      openRef.current = next;
      setOpen(next);
      setEditing(false);
    };
    dom.addEventListener("click", handleClick);
    return () => dom.removeEventListener("click", handleClick);
  }, [editor, close]);

  // Reposition on scroll/resize while open.
  React.useEffect(() => {
    if (!open) return;
    const handle = () => bumpPosition();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [open]);

  // Close on Escape or a mousedown outside both the popover and the editor.
  React.useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (editor.view.dom.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, editor, close]);

  const startEditing = React.useCallback(() => {
    if (!open) return;
    const { text, href } = readLinkInfo(editor, open);
    setTextValue(text);
    setUrlValue(href);
    setEditing(true);
  }, [editor, open]);

  const save = React.useCallback(() => {
    if (!open) return;
    const { from, to } = open;
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
    openRef.current = nextRange;
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
    setOpen(nextRange);
    setEditing(false);
  }, [editor, open, textValue, urlValue, close]);

  const removeLink = React.useCallback(() => {
    if (!open) return;
    const { from, to } = open;
    editor.chain().focus().setTextSelection({ from, to }).unsetLink().run();
    close();
  }, [editor, open, close]);

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

  if (!open) return null;

  let coords: { left: number; bottom: number } | null = null;
  try {
    coords = editor.view.coordsAtPos(open.from);
  } catch {
    coords = null;
  }
  if (!coords) return null;

  const MENU_WIDTH = editing ? 288 : 320;
  const left = Math.min(coords.left, window.innerWidth - MENU_WIDTH - 8);
  const { href } = readLinkInfo(editor, open);

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        left: Math.max(8, left),
        top: coords.bottom + 6,
      }}
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
