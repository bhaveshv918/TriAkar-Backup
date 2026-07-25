-- TriAkar Business OS: gift orders.
--
-- Friends, clients, relatives, neighbours, anyone given a print for free. The order
-- still goes through the normal production/status/tracking flow, but is_gift marks
-- it as ₹0 revenue (admin-biz.html forces selling_price to 0 and is_paid to true when
-- this is checked, nothing is ever owed on something given away) and its real
-- production cost auto-logs as a biz_expenses row (category 'marketing', source
-- 'gift_order') so gifting still shows up in costing/Balance Sheet instead of
-- disappearing off the books entirely.
--
-- Safe, additive. Run once in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE biz_sales
  ADD COLUMN IF NOT EXISTS is_gift BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS biz_sales_is_gift_idx ON biz_sales (is_gift) WHERE is_gift;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name='biz_sales' AND column_name='is_gift';
-- ════════════════════════════════════════════════════════════════════════════════
