-- Per-user data isolation: adds user_id to items/tags/flashcards, changes the
-- tags unique constraint to (user_id, name), enables RLS on all four tables
-- and installs owner-only policies, then backfills existing rows to the user
-- whose id is supplied via the :backfill_user_id psql variable.
--
-- Idempotent: safe to re-run after a partial failure.
--
-- USAGE (via the bun runner, which substitutes the variable):
--   BACKFILL_USER_ID=<uuid> bun db/migrate-0001.ts

BEGIN;

-- 1. Add user_id columns as NULLABLE so the backfill can populate them.
ALTER TABLE "items"      ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE "tags"       ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "user_id" uuid;

-- Re-asserted default (matches generated migration).
ALTER TABLE "items" ALTER COLUMN "type" SET DEFAULT 'reading-list';

-- 2. Backfill: assign existing rows with NULL user_id to the specified user.
UPDATE "items"      SET "user_id" = :backfill_user_id WHERE "user_id" IS NULL;
UPDATE "tags"       SET "user_id" = :backfill_user_id WHERE "user_id" IS NULL;
UPDATE "flashcards" SET "user_id" = :backfill_user_id WHERE "user_id" IS NULL;

-- 3. Swap the tags unique constraint (name) -> (user_id, name).
ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "tags_name_unique";
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tags_user_id_name_unique'
  ) THEN
    ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_name_unique" UNIQUE ("user_id", "name");
  END IF;
END $$;

-- 4. Enforce NOT NULL now that rows have values.
ALTER TABLE "items"      ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "tags"       ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "flashcards" ALTER COLUMN "user_id" SET NOT NULL;

-- 5. Foreign keys to auth.users, cascading deletes.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_user_id_fk') THEN
    ALTER TABLE "items" ADD CONSTRAINT "items_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_user_id_fk') THEN
    ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flashcards_user_id_fk') THEN
    ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Indexes that app queries rely on.
CREATE INDEX IF NOT EXISTS "items_user_type_position_idx"
  ON "items" USING btree ("user_id", "type", "position");
CREATE INDEX IF NOT EXISTS "flashcards_user_item_idx"
  ON "flashcards" USING btree ("user_id", "item_id");
CREATE INDEX IF NOT EXISTS "tags_user_id_idx"
  ON "tags" USING btree ("user_id");

-- 7. Enable RLS (idempotent).
ALTER TABLE "items"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "items"       FORCE  ROW LEVEL SECURITY;
ALTER TABLE "tags"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags"        FORCE  ROW LEVEL SECURITY;
ALTER TABLE "flashcards"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "flashcards"  FORCE  ROW LEVEL SECURITY;
ALTER TABLE "items_tags"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "items_tags"  FORCE  ROW LEVEL SECURITY;

-- 8. Grants for the `authenticated` role used by withUser().
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "items"      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "tags"       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "flashcards" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "items_tags" TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE "tags_id_seq" TO authenticated;

-- 9. Policies. DROP-then-CREATE to make this block idempotent.
DROP POLICY IF EXISTS "items_select_own" ON "items";
DROP POLICY IF EXISTS "items_insert_own" ON "items";
DROP POLICY IF EXISTS "items_update_own" ON "items";
DROP POLICY IF EXISTS "items_delete_own" ON "items";
CREATE POLICY "items_select_own" ON "items"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "items_insert_own" ON "items"
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "items_update_own" ON "items"
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "items_delete_own" ON "items"
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "tags_select_own" ON "tags";
DROP POLICY IF EXISTS "tags_insert_own" ON "tags";
DROP POLICY IF EXISTS "tags_update_own" ON "tags";
DROP POLICY IF EXISTS "tags_delete_own" ON "tags";
CREATE POLICY "tags_select_own" ON "tags"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "tags_insert_own" ON "tags"
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tags_update_own" ON "tags"
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tags_delete_own" ON "tags"
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "flashcards_select_own" ON "flashcards";
DROP POLICY IF EXISTS "flashcards_insert_own" ON "flashcards";
DROP POLICY IF EXISTS "flashcards_update_own" ON "flashcards";
DROP POLICY IF EXISTS "flashcards_delete_own" ON "flashcards";
CREATE POLICY "flashcards_select_own" ON "flashcards"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "flashcards_insert_own" ON "flashcards"
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "flashcards_update_own" ON "flashcards"
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "flashcards_delete_own" ON "flashcards"
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "items_tags_select_own" ON "items_tags";
DROP POLICY IF EXISTS "items_tags_insert_own" ON "items_tags";
DROP POLICY IF EXISTS "items_tags_delete_own" ON "items_tags";
CREATE POLICY "items_tags_select_own" ON "items_tags"
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM "items" i WHERE i.id = items_tags.item_id AND i.user_id = auth.uid())
  );
CREATE POLICY "items_tags_insert_own" ON "items_tags"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM "items" i WHERE i.id = items_tags.item_id AND i.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM "tags" t WHERE t.id = items_tags.tag_id AND t.user_id = auth.uid())
  );
CREATE POLICY "items_tags_delete_own" ON "items_tags"
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM "items" i WHERE i.id = items_tags.item_id AND i.user_id = auth.uid())
  );

COMMIT;
