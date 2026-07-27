import { TaskItem, TaskList } from "@tiptap/extension-list";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import React from "react";
import { toast } from "sonner";
import { Markdown } from "tiptap-markdown";

import { ImageLightbox } from "@/components/editor/image-lightbox";
import { ItemLink } from "@/components/editor/item-link";
import { ItemLinkMenu } from "@/components/editor/item-link-menu";
import { ItemLinkSuggestion } from "@/components/editor/item-link-suggestion";
import { MarkdownBubbleMenu } from "@/components/editor/markdown-bubble-menu";
import { Card, CardBack, CardFront } from "@/components/editor/markdown-card";
import { MarkdownLinkMenu } from "@/components/editor/markdown-link-popover";
import { BlockMath, InlineMath } from "@/components/editor/markdown-math";
import { uploadImage } from "@/lib/image-upload";
import { lowlight } from "@/lib/lowlight";
import {
  CleanClipboardMarkdown,
  CodeBlockWithLineNav,
  DeleteEmptyFirstBlock,
  JoinAdjacentLists,
  ParagraphWithBlankLines,
  TaskListMarkdownShortcut,
} from "@/lib/tiptap/extensions";
import { ImageUpload } from "@/lib/tiptap-image-upload";
import { cn } from "@/lib/utils";

type MarkdownStorage = { markdown: { getMarkdown: () => string } };

export const MarkdownEditor = ({
  value,
  onChange,
  placeholder,
  className,
  editable = true,
  autoFocus = false,
  editorAttributes,
  onKeyDown,
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  autoFocus?: boolean;
  editorAttributes?: Record<string, string>;
  onKeyDown?: (event: KeyboardEvent) => boolean | void;
}) => {
  const onChangeRef = React.useRef(onChange);
  const onKeyDownRef = React.useRef(onKeyDown);
  const [lightboxSrc, setLightboxSrc] = React.useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = React.useState("");
  React.useEffect(() => {
    onChangeRef.current = onChange;
    onKeyDownRef.current = onKeyDown;
  });

  const handleEditorClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.tagName !== "IMG") return;
      // Item-link favicons are chrome, not content images — clicking them
      // navigates to the item instead of opening the lightbox.
      if (target.closest("[data-item-link]")) return;
      const img = target as HTMLImageElement;
      if (img.dataset.uploading === "true") return;
      if (!img.src) return;
      event.preventDefault();
      setLightboxSrc(img.src);
      setLightboxAlt(img.alt || "Enlarged image");
    },
    [],
  );

  const handleLightboxOpenChange = React.useCallback((open: boolean) => {
    if (!open) setLightboxSrc(null);
  }, []);

  const getMarkdown = React.useCallback(
    (e: NonNullable<typeof editor>) =>
      (e.storage as unknown as MarkdownStorage).markdown.getMarkdown(),
    [],
  );

  const hasInflightUpload = React.useCallback(
    (e: NonNullable<typeof editor>) => {
      let uploading = false;
      e.state.doc.descendants((node) => {
        if (uploading) return false;
        if (node.type.name === "image" && node.attrs.uploading) {
          uploading = true;
          return false;
        }
        return true;
      });
      return uploading;
    },
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        paragraph: false,
        // Clicking a link should place the caret so the link popover can appear,
        // not navigate away from the editor.
        link: { openOnClick: false },
      }),
      ParagraphWithBlankLines,
      CodeBlockWithLineNav.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TaskListMarkdownShortcut,
      JoinAdjacentLists,
      DeleteEmptyFirstBlock,
      Card,
      CardFront,
      CardBack,
      InlineMath,
      BlockMath,
      ItemLink,
      ItemLinkSuggestion,
      ImageUpload.configure({
        upload: uploadImage,
        onUploadError: (message) =>
          toast.error("Image upload failed", { description: message }),
      }),
      CleanClipboardMarkdown,
      Markdown.configure({
        html: true,
        breaks: true,
        transformPastedText: true,
        // Serialize the selection as markdown on copy. Without this, copying
        // falls back to ProseMirror's default text serializer, which joins
        // every block with a blank line — so a tight bullet list comes out
        // with an empty line between each item.
        transformCopiedText: true,
      }),
      Placeholder.configure({
        includeChildren: true,
        showOnlyCurrent: false,
        placeholder: ({ pos, editor: e }) => {
          const parent = e.state.doc.resolve(pos).parent;
          if (parent.type.name === "cardFront") return "Front";
          if (parent.type.name === "cardBack") return "Back";
          return placeholder ?? "";
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      if (hasInflightUpload(editor)) return;
      onChangeRef.current?.(getMarkdown(editor));
    },
    editorProps: {
      attributes: editorAttributes ?? {},
      handleKeyDown: (_view, event) => {
        return onKeyDownRef.current?.(event) ?? false;
      },
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    if (getMarkdown(editor) !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor, getMarkdown]);

  React.useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  return (
    <div
      className={cn("markdown-editor w-full", className)}
      onClick={handleEditorClick}
    >
      <EditorContent editor={editor} />
      {editor && editable && (
        <>
          <MarkdownBubbleMenu editor={editor} />
          <MarkdownLinkMenu editor={editor} />
          <ItemLinkMenu editor={editor} />
        </>
      )}
      <ImageLightbox
        src={lightboxSrc}
        alt={lightboxAlt}
        onOpenChange={handleLightboxOpenChange}
      />
    </div>
  );
};
