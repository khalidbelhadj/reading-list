-- db/drop-legacy.sql — one-shot migration for databases created before the
-- 2026-08-30 backend simplification (old frontend removed; tags, the
-- embedding/extraction pipeline, and review bookkeeping deleted).
--
-- DESTRUCTIVE: permanently deletes all tag assignments, extracted content,
-- embeddings, and review history. The surviving tables (items, flashcards,
-- user_settings) are untouched — flashcards keep their SRS scheduling state.
--
-- Run once, after deploying the new code:
--   psql "$DATABASE_URL" -f db/drop-legacy.sql
-- then re-run db/setup.sql to refresh triggers and policies.

BEGIN;

-- DROP TABLE removes each table's policies and sync triggers with it; the
-- items_sync_notify function itself survives on items and flashcards.

-- Tags.
DROP TABLE IF EXISTS public.items_tags;
DROP TABLE IF EXISTS public.tags;

-- Review bookkeeping (sessions, per-rating history, telemetry events).
DROP TABLE IF EXISTS public.review_events;
DROP TABLE IF EXISTS public.card_reviews;
DROP TABLE IF EXISTS public.review_sessions;

-- Extraction + embeddings.
DROP TABLE IF EXISTS public.item_chunks;
DROP TABLE IF EXISTS public.item_content;
DROP TABLE IF EXISTS public.app_settings;

COMMIT;
