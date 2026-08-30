import {
  IconBlockquote,
  IconBold,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconItalic,
  IconList,
  IconListCheck,
  IconListNumbers,
  IconPilcrow,
  type IconProps,
  IconSourceCode,
  IconStrikethrough,
  IconUnderline,
} from "@tabler/icons-react";
import { type Editor } from "@tiptap/react";

// The formatting vocabulary shared by the bubble menu and the toolbar: which
// marks and block types exist, their icons, and how to toggle them.

export type EditorAction = {
  key: string;
  label: string;
  Icon: React.ComponentType<IconProps>;
  active: boolean;
  run: () => void;
  shortcut?: string;
};

export const selectFormatState = ({ editor }: { editor: Editor }) => ({
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
  canUndo: editor.can().undo(),
  canRedo: editor.can().redo(),
  from: editor.state.selection.from,
  to: editor.state.selection.to,
});

export type FormatState = ReturnType<typeof selectFormatState>;

export const markActions = (
  editor: Editor,
  state: FormatState,
): EditorAction[] => [
  {
    key: "bold",
    label: "Bold",
    Icon: IconBold,
    active: state.bold,
    shortcut: "⌘B",
    run: () => editor.chain().focus().toggleBold().run(),
  },
  {
    key: "italic",
    label: "Italic",
    Icon: IconItalic,
    active: state.italic,
    shortcut: "⌘I",
    run: () => editor.chain().focus().toggleItalic().run(),
  },
  {
    key: "underline",
    label: "Underline",
    Icon: IconUnderline,
    active: state.underline,
    shortcut: "⌘U",
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
    shortcut: "⌘E",
    run: () => editor.chain().focus().toggleCode().run(),
  },
];

export const blockActions = (
  editor: Editor,
  state: FormatState,
): EditorAction[] => [
  {
    key: "paragraph",
    label: "Text",
    Icon: IconPilcrow,
    active: state.paragraph,
    run: () => editor.chain().focus().setParagraph().run(),
  },
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

// A list item or quote wraps a paragraph, so "paragraph" reads as active
// inside them too; prefer the more specific container.
export const activeBlock = (actions: EditorAction[]): EditorAction =>
  actions.find((action) => action.key !== "paragraph" && action.active) ??
  (actions[0] as EditorAction);
