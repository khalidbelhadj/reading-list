-- db/setup.sql — post-schema DDL that `drizzle-kit push` does NOT manage.
--
-- `bun run db:push` reconciles the live database against db/schema.ts, but it
-- only knows about tables and columns. Everything below — extensions, search
-- indexes, row-level security, per-user policies, role grants, and the
-- cross-device Realtime sync trigger — lives here because push never touches
-- it. This file is the source of truth for the database's security and sync
-- layer.
--
-- Idempotent: every statement is CREATE ... IF NOT EXISTS, ENABLE (no-op if
-- already on), or DROP POLICY IF EXISTS ... CREATE. Safe to re-run.
--
-- Targets a Supabase Postgres (references auth.uid(), the `authenticated`
-- role, and realtime.send()).
--
-- USAGE — always after a schema push, on any fresh or existing environment:
--   bun run db:push
--   bun run db:setup      (or: psql "$DATABASE_URL" -f db/setup.sql)

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
-- Trigram similarity powers fuzzy search (lib/search.server.ts).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- 2. Trigram (GIN) search indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS items_title_trgm_idx
  ON public.items USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS items_notes_trgm_idx
  ON public.items USING gin (notes gin_trgm_ops);
CREATE INDEX IF NOT EXISTS flashcards_front_trgm_idx
  ON public.flashcards USING gin (front gin_trgm_ops);
CREATE INDEX IF NOT EXISTS flashcards_back_trgm_idx
  ON public.flashcards USING gin (back gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 3. Grants for the `authenticated` role used by withUser() (db/index.ts)
-- ---------------------------------------------------------------------------
-- Supabase grants these by default via ALTER DEFAULT PRIVILEGES, so
-- push-created tables already carry them. Restated here for self-containment
-- and so the security layer is legible in one place.
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.items         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Enable row-level security
-- ---------------------------------------------------------------------------
-- The app never connects as the owner (it runs as `authenticated`), so FORCE
-- does not change request-path behavior; it just closes the owner loophole.
ALTER TABLE public.items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items         FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.flashcards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards    FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings FORCE  ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5. Owner-only policies (DROP-then-CREATE for idempotency)
-- ---------------------------------------------------------------------------

-- items
DROP POLICY IF EXISTS "items_select_own" ON public.items;
DROP POLICY IF EXISTS "items_insert_own" ON public.items;
DROP POLICY IF EXISTS "items_update_own" ON public.items;
DROP POLICY IF EXISTS "items_delete_own" ON public.items;
CREATE POLICY "items_select_own" ON public.items
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "items_insert_own" ON public.items
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "items_update_own" ON public.items
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "items_delete_own" ON public.items
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- flashcards
DROP POLICY IF EXISTS "flashcards_select_own" ON public.flashcards;
DROP POLICY IF EXISTS "flashcards_insert_own" ON public.flashcards;
DROP POLICY IF EXISTS "flashcards_update_own" ON public.flashcards;
DROP POLICY IF EXISTS "flashcards_delete_own" ON public.flashcards;
CREATE POLICY "flashcards_select_own" ON public.flashcards
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "flashcards_insert_own" ON public.flashcards
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "flashcards_update_own" ON public.flashcards
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "flashcards_delete_own" ON public.flashcards
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- user_settings
DROP POLICY IF EXISTS "user_settings_select_own" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_insert_own" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_update_own" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_delete_own" ON public.user_settings;
CREATE POLICY "user_settings_select_own" ON public.user_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_settings_insert_own" ON public.user_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_settings_update_own" ON public.user_settings
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_settings_delete_own" ON public.user_settings
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. Cross-device sync: broadcast-from-database Realtime trigger
-- ---------------------------------------------------------------------------
-- Whenever reading-list data changes (web server actions, MCP server, any
-- write path running as the user), a trigger broadcasts a "data-changed" ping
-- on the per-user private topic "items-sync:<user_id>". Each signed-in device
-- subscribes to its own topic (components/items-sync-watcher.tsx) and
-- invalidates the affected React Query caches. Uses realtime.send(), not
-- postgres_changes, so no publication setup is needed.
--
-- SECURITY INVOKER (the default): app writes run as `authenticated` inside
-- withUser(), so auth.uid() is set. realtime.send() is also SECURITY INVOKER,
-- so its INSERT into realtime.messages is RLS-checked and needs the
-- "items_sync_send_own" policy below to emit at all.
CREATE OR REPLACE FUNCTION public.items_sync_notify()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $func$
DECLARE
  sync_user_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    sync_user_id := OLD.user_id;
  ELSE
    sync_user_id := NEW.user_id;
  END IF;

  IF sync_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Best-effort: a failed broadcast must never fail the write itself, but
  -- leave a trace in the Postgres logs so failures are diagnosable.
  -- 'origin' carries the writing client's sync id (set by withUser() from the
  -- sync-origin cookie) so that client can ignore its own echo; empty/absent
  -- for writes with no browser origin (MCP, scripts) — those invalidate
  -- every client, as before.
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'origin', COALESCE(current_setting('app.sync_origin', true), '')
      ),
      'data-changed', -- must match ITEMS_SYNC_EVENT in lib/items-sync.ts
      'items-sync:' || sync_user_id::text,
      true -- private channel
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'items_sync_notify failed for %: %', TG_TABLE_NAME, SQLERRM;
  END;

  RETURN NULL;
END;
$func$;

-- Triggers on every table the items/flashcards queries read from.
DROP TRIGGER IF EXISTS items_sync_notify ON public.items;
CREATE TRIGGER items_sync_notify
  AFTER INSERT OR UPDATE OR DELETE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.items_sync_notify();

DROP TRIGGER IF EXISTS items_sync_notify ON public.flashcards;
CREATE TRIGGER items_sync_notify
  AFTER INSERT OR UPDATE OR DELETE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.items_sync_notify();

-- Let each user SEND broadcasts on their own private topic. realtime.send()
-- runs as the caller (`authenticated`) and its INSERT into realtime.messages
-- is RLS-checked, so the trigger needs this INSERT policy to emit at all.
DROP POLICY IF EXISTS "items_sync_send_own" ON "realtime"."messages";
CREATE POLICY "items_sync_send_own" ON "realtime"."messages"
  FOR INSERT TO authenticated
  WITH CHECK (
    extension = 'broadcast'
    AND topic = 'items-sync:' || (SELECT auth.uid()::text)
  );

-- Let each user RECEIVE broadcasts on their own private topic. Realtime
-- evaluates this SELECT policy when a client joins / reads a private channel.
DROP POLICY IF EXISTS "items_sync_receive_own" ON "realtime"."messages";
CREATE POLICY "items_sync_receive_own" ON "realtime"."messages"
  FOR SELECT TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND realtime.topic() = 'items-sync:' || (SELECT auth.uid()::text)
  );

-- ── note-images storage bucket ──────────────────────────────────────────────
-- Private bucket for pasted note images. Objects are namespaced by owner id
-- ("<user_id>/<uuid>.<ext>"); server code issues signed upload/read URLs. The
-- owner policy scopes every operation to the caller's own top-level folder.
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-images', 'note-images', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "note_images_owner_all" ON storage.objects;
CREATE POLICY "note_images_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'note-images' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
  WITH CHECK (bucket_id = 'note-images' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

COMMIT;
