-- ═══════════════════════════════════════════════════════════════════════
-- TriAkar — Promo Code Seeds
-- Run in Supabase SQL Editor. Idempotent — ON CONFLICT (code) DO NOTHING.
--
-- Uses the LIVE promo_codes schema (see server/db/schema.sql):
--   code, description, discount_type ['free_shipping'|'percent'|'fixed'],
--   discount_value, min_order_amount, max_uses, current_uses, product_slug,
--   is_active, expires_at
-- Do NOT add columns here — promoController.js validates against these exactly.
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO promo_codes
  (code, description, discount_type, discount_value, min_order_amount, max_uses, is_active)
VALUES
  ('WELCOME10', '10% off your first order', 'percent', 10, 499, NULL, true)
ON CONFLICT (code) DO NOTHING;

-- Free shipping promo (optional — also seeded for launch campaigns)
INSERT INTO promo_codes
  (code, description, discount_type, discount_value, min_order_amount, max_uses, is_active)
VALUES
  ('FREESHIP', 'Free shipping on this order', 'free_shipping', 0, 0, NULL, true)
ON CONFLICT (code) DO NOTHING;
