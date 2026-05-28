-- ════════════════════════════════════════════════════════════════════════
-- TriAkar Migration 001 — Orders columns, invoice_number, performance indexes
-- ════════════════════════════════════════════════════════════════════════
-- SAFE TO RE-RUN. Every statement is idempotent (IF NOT EXISTS / OR REPLACE).
-- Run this whole file in the Supabase SQL Editor.
--
-- Why: the base schema.sql created a minimal `orders` table. Over time the
-- backend (paymentController.js) began writing extra columns. This migration
-- guarantees every column the code references exists, backfills invoice_number
-- from order_id, and adds indexes the app queries need.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. ORDERS: ensure all referenced columns exist ──────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal             NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_charge      NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_id             TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number       TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name        TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email       TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone       TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code           TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount      NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status         TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status       TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_received     BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method       TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at              TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS advance_received     BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS advance_amount       NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_vendor      TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number      TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expected_delivery    DATE;

-- ── 2. Backfill invoice_number from existing order_id (TRK- orders only) ──
UPDATE orders
   SET invoice_number = order_id
 WHERE invoice_number IS NULL
   AND order_id LIKE 'TRK-%';

-- ── 3. PROFILES: extra optional columns ─────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_address_id UUID;

-- ── 4. PERFORMANCE INDEXES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_user_id        ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at     ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_id       ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_slug         ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category     ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active    ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_reviews_product_slug  ON reviews(product_slug);
CREATE INDEX IF NOT EXISTS idx_reviews_status        ON reviews(status);

-- ── 5. STOCK DECREMENT RPC (re-assert, idempotent) ──────────────────────
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_qty INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE products SET stock_qty = GREATEST(0, stock_qty - p_qty)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════════
-- Done. Verify with:
--   SELECT column_name FROM information_schema.columns WHERE table_name='orders';
-- ════════════════════════════════════════════════════════════════════════
