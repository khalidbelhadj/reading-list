CREATE POLICY "review_sessions_select_own" ON "review_sessions"
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "review_sessions_insert_own" ON "review_sessions"
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "review_sessions_update_own" ON "review_sessions"
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "review_sessions_delete_own" ON "review_sessions"
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "card_reviews_select_own" ON "card_reviews"
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "card_reviews_insert_own" ON "card_reviews"
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "card_reviews_update_own" ON "card_reviews"
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "card_reviews_delete_own" ON "card_reviews"
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "review_events_select_own" ON "review_events"
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "review_events_insert_own" ON "review_events"
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "review_events_delete_own" ON "review_events"
  FOR DELETE TO authenticated USING (user_id = auth.uid());
