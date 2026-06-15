-- Cross-device cache invalidation via Realtime "broadcast from database".
--
-- Whenever reading-list data changes — from the web UI's server actions, the
-- MCP server, or any other write path that runs as the user — a trigger
-- broadcasts a small "data-changed" ping on the per-user private topic
-- "items-sync:<user_id>". Every signed-in device subscribes to its own topic
-- (components/items-sync-watcher.tsx) and invalidates the affected React
-- Query caches, so devices converge in near-real-time instead of holding
-- stale state until the next reload.
--
-- No table replication / publication setup is needed — this uses
-- realtime.send(), not postgres_changes.
--
-- Idempotent: safe to re-run.
--
-- USAGE: psql "$DATABASE_URL" -f drizzle/0011_items_sync_broadcast.sql
-- (or paste into the Supabase dashboard SQL editor)

BEGIN;

-- 1. Trigger function. SECURITY INVOKER (the default) on purpose: app writes
--    run as `authenticated` inside withUser(), so auth.uid() is set and the
--    items_tags -> items ownership lookup passes RLS. realtime.send() is also
--    SECURITY INVOKER, so its INSERT into realtime.messages runs as
--    `authenticated` and is subject to RLS — the "items_sync_send_own" policy
--    in section 3 grants it. Without that policy realtime.send() raises an RLS
--    error which its own EXCEPTION handler swallows as a WARNING, so the write
--    succeeds but no broadcast is emitted (silent no-sync).
CREATE OR REPLACE FUNCTION public.items_sync_notify()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $func$
DECLARE
  sync_user_id uuid;
BEGIN
  -- items_tags has no user_id column; derive the owner from the parent item.
  -- On cascade deletes the parent row is already gone — that's fine, the
  -- items trigger broadcasts for the same transaction.
  IF TG_TABLE_NAME = 'items_tags' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT i.user_id INTO sync_user_id FROM public.items i WHERE i.id = OLD.item_id;
    ELSE
      SELECT i.user_id INTO sync_user_id FROM public.items i WHERE i.id = NEW.item_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    sync_user_id := OLD.user_id;
  ELSE
    sync_user_id := NEW.user_id;
  END IF;

  IF sync_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Best-effort: a failed broadcast must never fail the write itself, but
  -- leave a trace in the Postgres logs so failures are diagnosable.
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object('table', TG_TABLE_NAME),
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

-- 2. Triggers on every table the items/flashcards queries read from.
DROP TRIGGER IF EXISTS items_sync_notify ON public.items;
CREATE TRIGGER items_sync_notify
  AFTER INSERT OR UPDATE OR DELETE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.items_sync_notify();

DROP TRIGGER IF EXISTS items_sync_notify ON public.tags;
CREATE TRIGGER items_sync_notify
  AFTER INSERT OR UPDATE OR DELETE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.items_sync_notify();

DROP TRIGGER IF EXISTS items_sync_notify ON public.items_tags;
CREATE TRIGGER items_sync_notify
  AFTER INSERT OR UPDATE OR DELETE ON public.items_tags
  FOR EACH ROW EXECUTE FUNCTION public.items_sync_notify();

DROP TRIGGER IF EXISTS items_sync_notify ON public.flashcards;
CREATE TRIGGER items_sync_notify
  AFTER INSERT OR UPDATE OR DELETE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.items_sync_notify();

-- 3a. Let each user SEND broadcasts on their own private topic. realtime.send()
--     runs as the caller (`authenticated`) and its INSERT into realtime.messages
--     is RLS-checked, so the trigger needs this INSERT policy to emit at all.
--     The new row's `topic` column is authoritative (realtime.send() also
--     SET LOCAL realtime.topic before inserting), so match on it directly.
DROP POLICY IF EXISTS "items_sync_send_own" ON "realtime"."messages";
CREATE POLICY "items_sync_send_own" ON "realtime"."messages"
  FOR INSERT TO authenticated
  WITH CHECK (
    extension = 'broadcast'
    AND topic = 'items-sync:' || (SELECT auth.uid()::text)
  );

-- 3b. Let each user RECEIVE broadcasts on their own private topic. Realtime
--     evaluates this SELECT policy on realtime.messages when a client joins /
--     reads a private channel.
DROP POLICY IF EXISTS "items_sync_receive_own" ON "realtime"."messages";
CREATE POLICY "items_sync_receive_own" ON "realtime"."messages"
  FOR SELECT TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND realtime.topic() = 'items-sync:' || (SELECT auth.uid()::text)
  );

COMMIT;
