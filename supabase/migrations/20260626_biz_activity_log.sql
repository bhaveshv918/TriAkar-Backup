-- TriAkar Business OS — immutable activity log (§2e)
-- 2026-06-26. Safe, additive. Run once in Supabase SQL Editor.
-- Records create/edit/delete across Business OS. Delete-proof: there is NO
-- update or delete policy for any role, so rows can only be inserted and read.

CREATE TABLE IF NOT EXISTS biz_activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT,
  action      TEXT,   -- create | edit | delete | restore
  entity      TEXT,   -- sale | product | customer | return | expense | roll
  entity_id   TEXT,
  detail      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_activity_log_created_idx ON biz_activity_log(created_at DESC);

ALTER TABLE biz_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS biz_activity_insert ON biz_activity_log;
CREATE POLICY biz_activity_insert ON biz_activity_log FOR INSERT TO authenticated
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');
DROP POLICY IF EXISTS biz_activity_select ON biz_activity_log;
CREATE POLICY biz_activity_select ON biz_activity_log FOR SELECT TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com');
-- (intentionally NO update/delete policy → immutable)
