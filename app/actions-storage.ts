"use server";

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

export async function uploadNoteImage(
  formData: FormData,
): Promise<{ url: string }> {
  const userId = await getCurrentUserId();

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");

  const ext = EXT_BY_MIME[file.type];
  if (!ext) throw new Error(`Unsupported image type: ${file.type}`);
  if (file.size > MAX_BYTES) throw new Error("Image is larger than 10 MB");

  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
