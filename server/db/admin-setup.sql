-- TriAkar Admin v2 Setup — Run in Supabase SQL Editor
-- Safe to run multiple times

-- ══════════════════════════════════════════════════════════════════════
-- CATEGORIES TABLE
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  icon          TEXT DEFAULT '📦',
  display_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active categories" ON categories;
CREATE POLICY "Anyone can read active categories" ON categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin can manage categories" ON categories;
CREATE POLICY "Admin can manage categories" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default categories
INSERT INTO categories (name, slug, icon, display_order) VALUES
  ('Desk', 'desk', '⬡', 1),
  ('Home Decor', 'decor', '◈', 2),
  ('Gifting', 'gifting', '◆', 3),
  ('Custom', 'custom', '△', 4)
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- PRODUCTS TABLE — ADD NEW COLUMNS
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE products ADD COLUMN IF NOT EXISTS material TEXT DEFAULT 'PLA+';
ALTER TABLE products ADD COLUMN IF NOT EXISTS colors TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_type TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS urgency_type TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS urgency_text TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS customization_fields JSONB DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_dropdowns JSONB DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes TEXT;

-- Product RLS
DROP POLICY IF EXISTS "Anyone can read active products" ON products;
CREATE POLICY "Anyone can read active products" ON products FOR SELECT USING (is_active = TRUE);
DROP POLICY IF EXISTS "Admin can read all products" ON products;
CREATE POLICY "Admin can read all products" ON products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert products" ON products;
CREATE POLICY "Admin can insert products" ON products FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admin can update products" ON products;
CREATE POLICY "Admin can update products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admin can delete products" ON products;
CREATE POLICY "Admin can delete products" ON products FOR DELETE TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════════════
-- ADMIN ACCESS LOGS — Security tracking
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          TEXT NOT NULL DEFAULT 'page_visit',
  ip              TEXT,
  user_agent      TEXT,
  screen_res      TEXT,
  timezone        TEXT,
  language        TEXT,
  platform        TEXT,
  referrer        TEXT,
  email_attempted TEXT,
  success         BOOLEAN DEFAULT FALSE,
  extra           JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
-- Anyone can insert logs (visitors aren't authenticated yet)
DROP POLICY IF EXISTS "Anyone can insert admin logs" ON admin_logs;
CREATE POLICY "Anyone can insert admin logs" ON admin_logs FOR INSERT WITH CHECK (true);
-- Only authenticated admin can read logs
DROP POLICY IF EXISTS "Admin can read admin logs" ON admin_logs;
CREATE POLICY "Admin can read admin logs" ON admin_logs FOR SELECT TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════════════
-- STORAGE BUCKET FOR PRODUCT IMAGES
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admin upload product images" ON storage.objects;
CREATE POLICY "Admin upload product images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admin manage product images" ON storage.objects;
CREATE POLICY "Admin manage product images" ON storage.objects
  FOR ALL TO authenticated USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'product-images');

-- ══════════════════════════════════════════════════════════════════════
-- ORDERS — ensure admin can read all
-- ══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admin can read all orders" ON orders;
CREATE POLICY "Admin can read all orders" ON orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can update orders" ON orders;
CREATE POLICY "Admin can update orders" ON orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
