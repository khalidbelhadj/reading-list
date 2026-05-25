-- Enable RLS + per-user policies for lists and items_lists
ALTER TABLE "lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "items_lists" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lists_select_own" ON "lists";
DROP POLICY IF EXISTS "lists_insert_own" ON "lists";
DROP POLICY IF EXISTS "lists_update_own" ON "lists";
DROP POLICY IF EXISTS "lists_delete_own" ON "lists";
CREATE POLICY "lists_select_own" ON "lists"
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "lists_insert_own" ON "lists"
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "lists_update_own" ON "lists"
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "lists_delete_own" ON "lists"
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "items_lists_select_own" ON "items_lists";
DROP POLICY IF EXISTS "items_lists_insert_own" ON "items_lists";
DROP POLICY IF EXISTS "items_lists_delete_own" ON "items_lists";
CREATE POLICY "items_lists_select_own" ON "items_lists"
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM "lists" l WHERE l.id = items_lists.list_id AND l.user_id = auth.uid())
  );
CREATE POLICY "items_lists_insert_own" ON "items_lists"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM "lists" l WHERE l.id = items_lists.list_id AND l.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM "items" i WHERE i.id = items_lists.item_id AND i.user_id = auth.uid())
  );
CREATE POLICY "items_lists_delete_own" ON "items_lists"
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM "lists" l WHERE l.id = items_lists.list_id AND l.user_id = auth.uid())
  );
