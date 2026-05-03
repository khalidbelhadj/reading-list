import Image, { type ImageOptions } from "@tiptap/extension-image";
import { Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export type ImageUploadFn = (file: File) => Promise<string>;
export type ImageUploadErrorFn = (message: string) => void;

export type ImageUploadOptions = ImageOptions & {
  upload: ImageUploadFn | null;
  onUploadError: ImageUploadErrorFn | null;
};

const isImageFile = (file: File) => file.type.startsWith("image/");

type FoundNode = { pos: number; size: number };

const findNodeByUploadId = (
  view: EditorView,
  uploadId: string,
): FoundNode | null => {
  let found: FoundNode | null = null;
  view.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === "image" && node.attrs.uploadId === uploadId) {
      found = { pos, size: node.nodeSize };
      return false;
    }
    return true;
  });
  return found;
};

const insertPlaceholders = (
  view: EditorView,
  startPos: number,
  files: File[],
  upload: ImageUploadFn,
  onError: ImageUploadErrorFn | null,
) => {
  const { schema, tr } = view.state;
  const imageType = schema.nodes.image;
  if (!imageType) return;

  const uploadIds: string[] = [];
  let pos = startPos;
  for (const file of files) {
    const uploadId = crypto.randomUUID();
    uploadIds.push(uploadId);
    const node = imageType.create({
      src: "",
      alt: file.name,
      uploadId,
      uploading: true,
    });
    tr.insert(pos, node);
    pos += node.nodeSize;
  }
  view.dispatch(tr);

  files.forEach((file, i) => {
    const uploadId = uploadIds[i];
    upload(file)
      .then((url) => {
        if (view.isDestroyed) return;
        const target = findNodeByUploadId(view, uploadId);
        if (!target) return;
        const node = view.state.doc.nodeAt(target.pos);
        if (!node) return;
        const attrs = {
          ...node.attrs,
          src: url,
          uploading: false,
          uploadId: null,
        };
        view.dispatch(view.state.tr.setNodeMarkup(target.pos, undefined, attrs));
      })
      .catch((err: unknown) => {
        if (!view.isDestroyed) {
          const target = findNodeByUploadId(view, uploadId);
          if (target) {
            view.dispatch(
              view.state.tr.delete(target.pos, target.pos + target.size),
            );
          }
        }
        const message = err instanceof Error ? err.message : "Upload failed";
        onError?.(message);
      });
  });
};

export const ImageUpload = Image.extend<ImageUploadOptions>({
  addOptions() {
    const parent = this.parent?.() as ImageOptions | undefined;
    const base: ImageOptions = parent ?? {
      inline: false,
      allowBase64: false,
      HTMLAttributes: {},
    } as ImageOptions;
    return {
      ...base,
      upload: null,
      onUploadError: null,
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      uploadId: {
        default: null as string | null,
        rendered: false,
      },
      uploading: {
        default: false,
        parseHTML: (el: HTMLElement) =>
          el.getAttribute("data-uploading") === "true",
        renderHTML: (attrs: { uploading?: boolean }) =>
          attrs.uploading ? { "data-uploading": "true" } : {},
      },
    };
  },

  addProseMirrorPlugins() {
    const parent = this.parent?.() ?? [];
    const upload = this.options.upload;
    const onError = this.options.onUploadError;
    if (!upload) return parent;

    return [
      ...parent,
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const files = event.clipboardData?.files;
            if (!files || files.length === 0) return false;
            const images = Array.from(files).filter(isImageFile);
            if (images.length === 0) return false;
            event.preventDefault();
            insertPlaceholders(
              view,
              view.state.selection.from,
              images,
              upload,
              onError,
            );
            return true;
          },
          handleDrop: (view, event, _slice, moved) => {
            if (moved) return false;
            const dragEvent = event as DragEvent;
            const files = dragEvent.dataTransfer?.files;
            if (!files || files.length === 0) return false;
            const images = Array.from(files).filter(isImageFile);
            if (images.length === 0) return false;
            event.preventDefault();
            const coords = view.posAtCoords({
              left: dragEvent.clientX,
              top: dragEvent.clientY,
            });
            const pos = coords?.pos ?? view.state.selection.from;
            insertPlaceholders(view, pos, images, upload, onError);
            return true;
          },
        },
      }),
    ];
  },
});
