// Server-only implementation — see ./actions-storage.ts for the RPC layer.
import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "note-images";
const MAX_BYTES = 10 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Issue a one-shot signed upload URL the browser can PUT to directly.
 * The signed URL is bound to a single path we control, so even if it
 * leaks the worst case is overwriting one (already user-owned) blob.
 *
 * Returns the public-facing src the editor should embed (a root-relative
 * path that resolves through /api/storage on read).
 */
export async function requestImageUpload({
  contentType,
  size,
}: {
  contentType: string;
  size: number;
}): Promise<{ uploadUrl: string; src: string }> {
  const userId = await getCurrentUserId();

  const ext = EXT_BY_MIME[contentType];
  if (!ext) throw new Error(`Unsupported image type: ${contentType}`);
  if (size <= 0) throw new Error("Empty file");
  if (size > MAX_BYTES) throw new Error("Image is larger than 10 MB");

  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error) throw new Error(error.message);

  return {
    uploadUrl: data.signedUrl,
    src: `/api/storage/${BUCKET}/${path}`,
  };
}
