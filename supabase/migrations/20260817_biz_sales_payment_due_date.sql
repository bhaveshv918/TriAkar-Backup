-- TriAkar Business OS — Payment Due Date on orders
-- Add Order's Payment card had no way to set when a balance payment is expected
-- (only a generic "Due Date" auto-computed from Order Date + a global Due Days
-- setting, used on the printed Invoice). This adds a real per-order date the
-- operator can pick, defaults to blank (no due date forced on every order).
-- Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_sales
  ADD COLUMN IF NOT EXISTS payment_due_date DATE;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT order_id, payment_due_date FROM biz_sales WHERE payment_due_date IS NOT NULL ORDER BY payment_due_date;
-- ════════════════════════════════════════════════════════════════════════════════
