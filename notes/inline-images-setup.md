# Inline Images: Supabase setup

Run these once in the Supabase dashboard (SQL editor) before merging the
`inline-images` branch.

## 1. Create the bucket

Storage → New bucket:

- Name: `note-images`
- Public bucket: **on**
- File size limit: 10 MB (matches `MAX_BYTES` in `app/actions-storage.ts`)
- Allowed MIME types: `image/png, image/jpeg, image/webp, image/gif`

## 2. RLS policies

```sql
-- Insert: authenticated users can write into their own folder (userId/...).
create policy "note_images_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'note-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete: authenticated users can delete their own files.
create policy "note_images_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'note-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Select is public (bucket is public). No SELECT policy needed.
```

## Notes

- File paths: `<userId>/<uuid>.<ext>`. The first folder segment is the user
  id so the RLS check is a simple equality on `(storage.foldername(name))[1]`.
- The server action uses the user's session via `createServerClient` —
  uploads run as the authenticated user, so the RLS `with check` actually
  matches. If you ever switch to the service role key for uploads, the RLS
  is bypassed; ensure you keep the userId-prefixed path either way.
- No SVG. The upload action's allowlist excludes `image/svg+xml` because
  SVGs can carry inline scripts; we'd need DOMPurify on upload to allow
  them safely.
