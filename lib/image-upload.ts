import { requestImageUpload } from "@/app/actions-storage";

// Two-step direct upload: ask the server for a signed URL, then PUT the bytes
// straight to Supabase. Our server only sees metadata. Returns the public src
// for the uploaded image.
export const uploadImage = async (file: File): Promise<string> => {
  const { uploadUrl, src } = await requestImageUpload({
    contentType: file.type,
    size: file.size,
  });
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
  return src;
};
