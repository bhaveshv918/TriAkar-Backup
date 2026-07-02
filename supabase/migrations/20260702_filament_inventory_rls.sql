-- TriAkar Business OS — RLS for filament_inventory (Spool Tracker)
-- 2026-07-02. Safe, additive. Run once in Supabase SQL Editor.
-- Locks down the physical spool audit table to the admin account only,
-- matching every other Business OS table (see 20260625_biz_filament.sql).

ALTER TABLE filament_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_filament_inventory" ON filament_inventory;
CREATE POLICY "biz_admin_only_filament_inventory" ON filament_inventory
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');
