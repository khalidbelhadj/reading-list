import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCheck,
  IconChevronDown,
  IconLink,
} from "@tabler/icons-react";
import { type Editor, useEditorState } from "@tiptap/react";
import React from "react";

import { cn } from "@/lib/utils";

import { Button } from "../button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../menu";
import { Tooltip } from "../tooltip";
import {
  activeBlock,
  blockActions,
  markActions,
  selectFormatState,
} from "./actions";
import { normalizeHref, preventBlur } from "./shared";

const Divider = () => <div className="mx-1 h-4 w-px bg-foreground/10" />;

// The optional header above the editor with every formatting control: block
// type, marks, link, the list and block toggles, undo and redo. Everything
// here is also reachable from the bubble and the keyboard; the header is for
// people who want the buttons in view.
export const EditorToolbar = ({
  editor,
  className,
}: {
  editor: Editor;
  className?: string;
}) => {
  const state = useEditorState({ editor, selector: selectFormatState });
  const marks = markActions(editor, state);
  const blocks = blockActions(editor, state);
  const current = activeBlock(blocks);
  const structure = blocks.filter((block) =>
    [
      "bulletList",
      "orderedList",
      "taskList",
      "blockquote",
      "codeBlock",
    ].includes(block.key),
  );
  const types = blocks.filter((block) => !structure.includes(block));

  const addLink = React.useCallback(() => {
    const existing =
      (editor.getAttributes("link").href as string | undefined) ?? "";
    // A prompt is deliberate here: the toolbar has no anchored field, and the
    // bubble's inline editor is the primary way to add links.
    const raw = window.prompt("Link", existing);
    if (raw === null) return;
    const href = normalizeHref(raw);
    if (href)
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    else editor.chain().focus().extendMarkRange("link").unsetLink().run();
  }, [editor]);

  return (
    <div
      data-markdown-menu=""
      className={cn("flex flex-wrap items-center gap-0.5", className)}
    >
      <Menu>
        <MenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 px-1.5"
              onMouseDown={preventBlur}
            />
          }
        >
          <current.Icon />
          {current.label}
          <IconChevronDown className="size-3 text-muted-foreground" />
        </MenuTrigger>
        <MenuContent>
          {types.map(({ key, label, Icon, run }) => (
            <MenuItem
              key={key}
              icon={<Icon />}
              onClick={run}
              shortcut={
                key === current.key ? (
                  <IconCheck className="size-3.5" />
                ) : undefined
              }
            >
              {label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      <Divider />
      {marks.map(({ key, label, Icon, active, run, shortcut }) => (
        <Tooltip key={key} content={shortcut ? `${label} ${shortcut}` : label}>
          <Button
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
        </Tooltip>
      ))}
      <Tooltip content="Link">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Link"
          aria-pressed={state.link}
          onMouseDown={preventBlur}
          onClick={addLink}
          className={cn(state.link && "bg-foreground/[0.09] text-foreground")}
        >
          <IconLink />
        </Button>
      </Tooltip>
      <Divider />
      {structure.map(({ key, label, Icon, active, run }) => (
        <Tooltip key={key} content={label}>
          <Button
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
        </Tooltip>
      ))}
      <Divider />
      <Tooltip content="Undo ⌘Z">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Undo"
          disabled={!state.canUndo}
          onMouseDown={preventBlur}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <IconArrowBackUp />
        </Button>
      </Tooltip>
      <Tooltip content="Redo ⇧⌘Z">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Redo"
          disabled={!state.canRedo}
          onMouseDown={preventBlur}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <IconArrowForwardUp />
        </Button>
      </Tooltip>
    </div>
  );
};
