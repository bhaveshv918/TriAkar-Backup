-- TriAkar Business OS — Order Status History
-- Every time an order's status changes (Order Received -> Processing -> Printing ->
-- Packed -> Dispatched -> Delivered, etc.), log a timestamped row instead of only
-- ever knowing the CURRENT status with no record of when it got there. Feeds future
-- KPIs, e.g. average time in Production, average time in Post-Processing.
-- Safe, additive. Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS biz_order_status_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   TEXT NOT NULL,
  status     TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_order_status_log_order_idx ON biz_order_status_log (order_id);
CREATE INDEX IF NOT EXISTS biz_order_status_log_status_idx ON biz_order_status_log (status);
CREATE INDEX IF NOT EXISTS biz_order_status_log_time_idx ON biz_order_status_log (changed_at);

ALTER TABLE biz_order_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_order_status_log" ON biz_order_status_log;
CREATE POLICY "biz_admin_only_order_status_log" ON biz_order_status_log
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com');

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT order_id, status, changed_at FROM biz_order_status_log ORDER BY changed_at DESC LIMIT 20;
-- ════════════════════════════════════════════════════════════════════════════════
