CREATE TABLE IF NOT EXISTS "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_settings_select_own" ON "user_settings";
DROP POLICY IF EXISTS "user_settings_insert_own" ON "user_settings";
DROP POLICY IF EXISTS "user_settings_update_own" ON "user_settings";
DROP POLICY IF EXISTS "user_settings_delete_own" ON "user_settings";

CREATE POLICY "user_settings_select_own" ON "user_settings"
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_settings_insert_own" ON "user_settings"
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_settings_update_own" ON "user_settings"
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_settings_delete_own" ON "user_settings"
  FOR DELETE TO authenticated USING (user_id = auth.uid());
