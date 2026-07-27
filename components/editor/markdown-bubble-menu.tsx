import {
  IconBlockquote,
  IconBold,
  IconCheck,
  IconChevronDown,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconItalic,
  IconLink,
  IconLinkOff,
  IconList,
  IconListCheck,
  IconListNumbers,
  IconPilcrow,
  type IconProps,
  IconSourceCode,
  IconStrikethrough,
  IconUnderline,
} from "@tabler/icons-react";
import { type Editor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import React from "react";

import { normalizeHref, preventBlur } from "@/components/editor/editor-shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const selectMenuState = ({ editor }: { editor: Editor }) => ({
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
});

type MenuState = ReturnType<typeof selectMenuState>;

const buildMarkActions = (editor: Editor, state: MenuState): MarkAction[] => [
  {
    key: "bold",
    label: "Bold",
    Icon: IconBold,
    active: state.bold,
    run: () => editor.chain().focus().toggleBold().run(),
  },
  {
    key: "italic",
    label: "Italic",
    Icon: IconItalic,
    active: state.italic,
    run: () => editor.chain().focus().toggleItalic().run(),
  },
  {
    key: "underline",
    label: "Underline",
    Icon: IconUnderline,
    active: state.underline,
    run: () => editor.chain().focus().toggleUnderline().run(),
  },
  {
    key: "strike",
    label: "Strikethrough",
    Icon: IconStrikethrough,
    active: state.strike,
    run: () => editor.chain().focus().toggleStrike().run(),
  },
  {
    key: "code",
    label: "Code",
    Icon: IconCode,
    active: state.code,
    run: () => editor.chain().focus().toggleCode().run(),
  },
];

const buildBlockActions = (
  editor: Editor,
  state: MenuState,
): { textAction: BlockAction; blockActions: BlockAction[] } => {
  const textAction: BlockAction = {
    key: "paragraph",
    label: "Text",
    Icon: IconPilcrow,
    active: state.paragraph,
    run: () => editor.chain().focus().setParagraph().run(),
  };
  const blockActions: BlockAction[] = [
    textAction,
    {
      key: "heading1",
      label: "Heading 1",
      Icon: IconH1,
      active: state.heading1,
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      key: "heading2",
      label: "Heading 2",
      Icon: IconH2,
      active: state.heading2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      key: "heading3",
      label: "Heading 3",
      Icon: IconH3,
      active: state.heading3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      key: "blockquote",
      label: "Quote",
      Icon: IconBlockquote,
      active: state.blockquote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      key: "bulletList",
      label: "Bullet list",
      Icon: IconList,
      active: state.bulletList,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: "orderedList",
      label: "Numbered list",
      Icon: IconListNumbers,
      active: state.orderedList,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      key: "taskList",
      label: "Checklist",
      Icon: IconListCheck,
      active: state.taskList,
      run: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      key: "codeBlock",
      label: "Code block",
      Icon: IconSourceCode,
      active: state.codeBlock,
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
  ];
  return { textAction, blockActions };
};

export const MarkdownBubbleMenu = ({ editor }: { editor: Editor }) => {
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkValue, setLinkValue] = React.useState("");
  const [blockMenuOpen, setBlockMenuOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const blockMenuRef = React.useRef<HTMLDivElement>(null);

  const editorState = useEditorState({
    editor,
    selector: selectMenuState,
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

  const actions = buildMarkActions(editor, editorState);
  const { textAction, blockActions } = buildBlockActions(editor, editorState);
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
      // Marks the menu element as editor chrome. The plugin appends it inside
      // the editor's parent, so clicks on it bubble up to ancestor click
      // handlers (e.g. the notes area's click-to-focus in detail-panel.tsx)
      // which must not treat them as clicks on the note itself.
      data-markdown-menu=""
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
