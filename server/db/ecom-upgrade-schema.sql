-- ═══════════════════════════════════════════════════════════════════════
-- TriAkar — E-commerce Upgrade Schema (additive)
-- Run in Supabase SQL Editor. Fully idempotent — safe to run multiple times.
--
-- This migration is ADDITIVE only. It does NOT recreate or alter any existing
-- table that already works (products, orders, order_items, carts, reviews,
-- promo_codes, profiles, user_addresses). It only adds:
--   1. wishlists           — new table (saved items per user)
--   2. order status timestamps — new columns for the tracking timeline
--   3. helpful indexes for discovery/search performance
-- Existing reviews + promo_codes tables are REUSED as-is (see schema.sql).
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. WISHLISTS — one row per (user, product)
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  product_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, product_slug)
);
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- Users manage only their own wishlist rows
DROP POLICY IF EXISTS "Users manage own wishlist" ON wishlists;
CREATE POLICY "Users manage own wishlist" ON wishlists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_slug    ON wishlists(product_slug);

-- ───────────────────────────────────────────────────────────────────────
-- 2. ORDERS — status timeline timestamps (for track-order visual timeline)
--    paid_at already exists (written by paymentController). These add the
--    remaining lifecycle stamps so the timeline can show real dates.
-- ───────────────────────────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at            TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at       TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS processing_at      TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at         TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at       TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery DATE;

-- ───────────────────────────────────────────────────────────────────────
-- 3. DISCOVERY / SEARCH INDEXES (products) — speed up listing + filters
-- ───────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active   ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_price    ON products(price);

-- ───────────────────────────────────────────────────────────────────────
-- Done. Verify with:
--   SELECT column_name FROM information_schema.columns WHERE table_name='orders';
--   SELECT * FROM wishlists LIMIT 1;
-- ───────────────────────────────────────────────────────────────────────
