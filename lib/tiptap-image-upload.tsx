import { IconPhotoOff } from "@tabler/icons-react";
import Image, { type ImageOptions } from "@tiptap/extension-image";
import { Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import React from "react";

import { Spinner } from "@/components/ui/spinner";

export type ImageUploadFn = (file: File) => Promise<string>;
export type ImageUploadErrorFn = (message: string) => void;

export type ImageUploadOptions = ImageOptions & {
  upload: ImageUploadFn | null;
  onUploadError: ImageUploadErrorFn | null;
};

const isImageFile = (file: File) => file.type.startsWith("image/");

const ImageUploadNodeView = ({
  node,
  editor,
  getPos,
  selected,
}: NodeViewProps) => {
  const src = (node.attrs.src as string | null) ?? "";
  const alt = (node.attrs.alt as string | null) ?? "";
  const title = (node.attrs.title as string | null) ?? undefined;
  const uploading = Boolean(node.attrs.uploading);
  const [errored, setErrored] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  // The src on the base <img>. Lags behind node.attrs.src during a blob→remote
  // swap: the overlay below crossfades on top, then promotes here.
  const [displayedSrc, setDisplayedSrc] = React.useState(src);
  // Crossfade overlay used during swaps (typically blob → remote URL). Sits
  // absolutely positioned over the base img, fades in when loaded, then
  // promotes to displayedSrc so the base swap is hidden by the overlay.
  const [overlaySrc, setOverlaySrc] = React.useState<string | null>(null);
  const [overlayLoaded, setOverlayLoaded] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const handleError = React.useCallback(() => setErrored(true), []);
  const handleLoad = React.useCallback(() => {
    setErrored(false);
    setLoaded(true);
  }, []);
  const handleOverlayLoad = React.useCallback(() => setOverlayLoaded(true), []);

  React.useEffect(() => {
    if (src === displayedSrc) return;
    setErrored(false);
    if (!loaded) {
      // Nothing visible yet — swap directly, the skeleton covers the gap.
      setDisplayedSrc(src);
      setOverlaySrc(null);
      setOverlayLoaded(false);
      return;
    }
    setOverlaySrc(src);
    setOverlayLoaded(false);
  }, [src, displayedSrc, loaded]);

  // Once the overlay has finished its fade-in, copy its src down to the base
  // and drop the overlay on the next frame so the base src change is committed
  // under cover of the still-mounted overlay.
  React.useEffect(() => {
    if (!overlaySrc || !overlayLoaded) return;
    const FADE_MS = 200;
    const timer = setTimeout(() => {
      setDisplayedSrc(overlaySrc);
      requestAnimationFrame(() => {
        setOverlaySrc(null);
        setOverlayLoaded(false);
      });
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [overlaySrc, overlayLoaded]);

  React.useEffect(() => {
    // Cached images may have finished loading before React attached onLoad.
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) setLoaded(true);
  }, [displayedSrc]);

  // True when a text-selection range crosses this node. NodeSelection (the
  // user clicked the image directly) is already exposed via `selected`.
  const [inRange, setInRange] = React.useState(false);
  React.useEffect(() => {
    const update = () => {
      const sel = editor.state.selection;
      if (sel.empty) {
        setInRange(false);
        return;
      }
      const pos = typeof getPos === "function" ? getPos() : null;
      if (typeof pos !== "number") {
        setInRange(false);
        return;
      }
      setInRange(pos < sel.to && pos + node.nodeSize > sel.from);
    };
    update();
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("selectionUpdate", update);
    };
  }, [editor, getPos, node.nodeSize]);
  const isSelected = selected || inRange;

  const showError = errored && !uploading && displayedSrc !== "";
  // Skeleton covers two cases: a freshly opened item where the remote image
  // hasn't loaded yet, AND the first frames of an upload before the blob has
  // decoded (otherwise the wrapper sits at 0×0 and you see a flash when the
  // image suddenly appears).
  const showSkeleton = !loaded && !showError && displayedSrc !== "";
  return (
    <NodeViewWrapper
      as="span"
      className="image-upload-wrap"
      // Marks the whole image as ProseMirror's drag handle. Without this,
      // tiptap's NodeView.onDragStart bails and never sets up the node MOVE,
      // so the browser's native image-drag (a copy) takes over. With it, a
      // drag becomes a NodeSelection move — the image is relocated, not copied.
      data-drag-handle=""
      data-uploading={uploading ? "true" : undefined}
      data-errored={showError ? "true" : undefined}
      data-loading={showSkeleton ? "true" : undefined}
      data-selected={isSelected ? "true" : undefined}
    >
      {showError ? (
        <span className="image-upload-broken">
          <IconPhotoOff className="size-4 shrink-0" aria-hidden />
          <span>Image unavailable</span>
        </span>
      ) : (
        <>
          {/* Browser-native <img> is intentional: src is a user-uploaded blob or signed URL of unknown dimensions. */}
          {/* draggable={false} disables the browser's native image-drag so a
              drag inside the editor is handled by ProseMirror as a node MOVE
              rather than dropping a copy of the image. */}
          <img
            ref={imgRef}
            src={displayedSrc}
            alt={alt}
            title={title}
            loading="lazy"
            decoding="async"
            draggable={false}
            data-uploading={uploading ? "true" : undefined}
            onError={handleError}
            onLoad={handleLoad}
          />
          {overlaySrc && (
            <img
              src={overlaySrc}
              alt=""
              aria-hidden
              decoding="async"
              draggable={false}
              className="image-upload-overlay"
              data-visible={overlayLoaded ? "true" : undefined}
              onLoad={handleOverlayLoad}
            />
          )}
        </>
      )}
      {uploading && loaded && (
        <Spinner
          aria-label="Uploading image"
          className="pointer-events-none absolute top-1/2 left-1/2 -mt-3 -ml-3 size-6 text-foreground"
        />
      )}
    </NodeViewWrapper>
  );
};

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

const objectUrls = new Map<string, string>();

const releaseObjectUrl = (uploadId: string) => {
  const url = objectUrls.get(uploadId);
  if (!url) return;
  URL.revokeObjectURL(url);
  objectUrls.delete(uploadId);
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
    const objectUrl = URL.createObjectURL(file);
    objectUrls.set(uploadId, objectUrl);
    const node = imageType.create({
      src: objectUrl,
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
    if (!uploadId) return;
    upload(file)
      .then((url) => {
        if (view.isDestroyed) {
          releaseObjectUrl(uploadId);
          return;
        }
        const target = findNodeByUploadId(view, uploadId);
        if (!target) {
          releaseObjectUrl(uploadId);
          return;
        }
        const node = view.state.doc.nodeAt(target.pos);
        if (!node) {
          releaseObjectUrl(uploadId);
          return;
        }
        const attrs = {
          ...node.attrs,
          src: url,
          uploading: false,
          uploadId: null,
        };
        view.dispatch(
          view.state.tr.setNodeMarkup(target.pos, undefined, attrs),
        );
        releaseObjectUrl(uploadId);
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
        releaseObjectUrl(uploadId);
        const message = err instanceof Error ? err.message : "Upload failed";
        onError?.(message);
      });
  });
};

export const ImageUpload = Image.extend<ImageUploadOptions>({
  addOptions() {
    const parent = this.parent?.() as ImageOptions | undefined;
    const base: ImageOptions =
      parent ??
      ({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {},
      } as ImageOptions);
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

  addNodeView() {
    return ReactNodeViewRenderer(ImageUploadNodeView);
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
            const pos = coords?.pos ?? view.state.doc.content.size;
            insertPlaceholders(view, pos, images, upload, onError);
            return true;
          },
        },
      }),
    ];
  },
});
