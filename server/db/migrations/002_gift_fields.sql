-- ════════════════════════════════════════════════════════════════════════
-- TriAkar Migration 002 — Gift order fields + first-order promo code
-- ════════════════════════════════════════════════════════════════════════
-- SAFE TO RE-RUN. Every statement is idempotent.
-- Run this whole file in the Supabase SQL Editor.
--
-- Why:
--   F11 — checkout now lets a buyer mark an order as a gift and attach a
--         short gift message. paymentController.js writes orders.is_gift and
--         orders.gift_message; this migration adds those columns.
--   F8  — checkout shows a first-order offer "TRIAKAR10" (10% off, min ₹999).
--         This seeds that promo code so promoController.js can validate it.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. ORDERS: gift fields ──────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_gift      BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_message TEXT;

-- ── 2. PROMO: first-order offer (TRIAKAR10) ─────────────────────────────
-- Uses the LIVE promo_codes schema (code, description, discount_type,
-- discount_value, min_order_amount, max_uses, is_active).
INSERT INTO promo_codes
  (code, description, discount_type, discount_value, min_order_amount, max_uses, is_active)
VALUES
  ('TRIAKAR10', '10% off your first order (min ₹999)', 'percent', 10, 999, NULL, true)
ON CONFLICT (code) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════
-- Done. Verify with:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='orders' AND column_name IN ('is_gift','gift_message');
--   SELECT code, discount_type, discount_value, min_order_amount
--     FROM promo_codes WHERE code='TRIAKAR10';
-- ════════════════════════════════════════════════════════════════════════
