-- TriAkar Business OS — persist Round Off on orders
-- Add Order already computed a round-off figure for the on-screen Grand Total
-- preview, but never saved it, so it vanished the moment the order was created
-- and never appeared on the printed Invoice/Order Record. Stored once per order
-- (on the first line item, same convention as platform_fee/shipping_fee).
-- Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_sales
  ADD COLUMN IF NOT EXISTS round_off NUMERIC(6,2) NOT NULL DEFAULT 0;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT order_id, round_off FROM biz_sales WHERE round_off <> 0 ORDER BY order_date DESC LIMIT 20;
-- ════════════════════════════════════════════════════════════════════════════════
