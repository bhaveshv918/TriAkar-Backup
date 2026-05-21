-- ═══════════════════════════════════════════════════════════
-- TRIAKAR — Product Management Schema v1
-- Run in Supabase SQL Editor.
-- Safe to run multiple times — uses IF NOT EXISTS / ON CONFLICT.
-- ═══════════════════════════════════════════════════════════

-- ── PART 1: Order Payment Columns ──────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_received  boolean       default false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS advance_amount    numeric(10,2) default 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS advance_received  boolean       default false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_notes     text;

-- razorpay_payment_id already exists in schema.sql / schema-v2.sql
-- but add defensively in case it was missed
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id text;

-- ── PART 6: Categories Table ────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id             uuid    default gen_random_uuid() primary key,
  name           text    not null,
  slug           text    unique not null,
  description    text,
  display_order  integer default 0,
  is_active      boolean default true,
  created_at     timestamp with time zone default now()
);

-- Seed default categories (safe — skips if slug already exists)
INSERT INTO categories (name, slug, display_order) VALUES
  ('All Products',  'all',          0),
  ('Desk',          'desk',         1),
  ('Home',          'home',         2),
  ('Gifting',       'gifting',      3),
  ('Custom Parts',  'custom-parts', 4)
ON CONFLICT (slug) DO NOTHING;

-- RLS for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Public can read active categories
DROP POLICY IF EXISTS "categories_public_read"  ON categories;
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT USING (is_active = true);

-- Authenticated admin can do everything
-- (admin.html uses service-role key directly, so no RLS restriction needed for admin)
DROP POLICY IF EXISTS "categories_admin_all"    ON categories;
CREATE POLICY "categories_admin_all" ON categories
  FOR ALL USING (auth.role() = 'authenticated');

-- ── PART 7: Product Description Columns ────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description       text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS long_description        text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bullet_points           jsonb  default '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_display_mode text  default 'both';
-- description_display_mode values:
--   'short_only'   show only short description
--   'long_only'    show only long description
--   'bullets_only' show only bullet points
--   'both'         short + long (default)
--   'all'          short on card, long + bullets on detail

-- Compare-at price / SKU (for Part 11 product form)
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price       numeric(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku                    text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold    integer default 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags                   text[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS customization_prompt   text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_colors       jsonb  default '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_materials    jsonb  default '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS production_days        integer default 3;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_title             text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description       text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS material               text   default 'PLA+';

-- ── Verify: show current columns for confirmation ───────────
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'orders'   ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'products' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'categories' ORDER BY ordinal_position;
