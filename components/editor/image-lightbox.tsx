import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import React from "react";
import { toast } from "sonner";

import { isModKey } from "@/lib/input-context";

// Full-screen preview for images clicked inside the markdown editor, with
// Cmd/Ctrl+C to copy the image itself (re-encoded to PNG) to the clipboard.
export const ImageLightbox = ({
  src,
  alt,
  onOpenChange,
}: {
  src: string | null;
  alt: string;
  onOpenChange: (open: boolean) => void;
}) => {
  const handlePopupClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onOpenChange(false);
    },
    [onOpenChange],
  );

  React.useEffect(() => {
    if (!src) return;
    const handler = async (event: KeyboardEvent) => {
      if (!isModKey(event) || event.key !== "c") return;
      if (window.getSelection()?.toString()) return;
      event.preventDefault();
      try {
        const response = await fetch(src);
        const sourceBlob = await response.blob();
        const bitmap = await createImageBitmap(sourceBlob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas context");
        ctx.drawImage(bitmap, 0, 0);
        const pngBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!pngBlob) throw new Error("encode failed");
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngBlob }),
        ]);
        toast("Image copied");
      } catch {
        toast.error("Couldn't copy image", {
          description: "Your browser may have blocked clipboard access.",
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [src]);

  return (
    <DialogPrimitive.Root open={src !== null} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 duration-75 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          aria-label="Image preview"
          onClick={handlePopupClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 duration-75 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          {src && (
            // next/image needs known dimensions; previewed images are user-pasted with arbitrary sizes.
            <img
              src={src}
              alt={alt}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
