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

-- ── Secure RPC: lets anon check lockout by IP without reading all logs ──
CREATE OR REPLACE FUNCTION get_recent_failures(visitor_ip TEXT, lockout_seconds INT)
RETURNS TABLE(fail_count INT, last_fail_at TIMESTAMPTZ) AS $$
  SELECT
    COUNT(*)::INT,
    MAX(created_at)
  FROM admin_logs
  WHERE ip = visitor_ip
    AND action = 'login_attempt'
    AND success = false
    AND created_at >= NOW() - (lockout_seconds || ' seconds')::INTERVAL;
$$ LANGUAGE SQL SECURITY DEFINER;

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
-- ORDERS — admin full access + tracking columns
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_vendor TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE;

-- ── Invoice number auto-generation: TAINV/2627XXXX starting from 0100 ──
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 100 INCREMENT 1;

CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'TAINV/2627' || LPAD(nextval('invoice_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_number ON orders;
CREATE TRIGGER trg_invoice_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION set_invoice_number();

-- Backfill existing orders that don't have invoice numbers
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) + 99 AS num
  FROM orders WHERE invoice_number IS NULL
)
UPDATE orders SET invoice_number = 'TAINV/2627' || LPAD(numbered.num::TEXT, 4, '0')
FROM numbered WHERE orders.id = numbered.id;

-- Sync the sequence to the max existing number
SELECT setval('invoice_seq', COALESCE(
  (SELECT MAX(NULLIF(RIGHT(invoice_number, 4), '')::INT) FROM orders WHERE invoice_number IS NOT NULL),
  99
));

-- ── Public RPC: track order by invoice number (no auth required) ──
CREATE OR REPLACE FUNCTION track_order_by_invoice(inv_number TEXT)
RETURNS JSON AS $$
  SELECT json_build_object(
    'found', true,
    'invoice_number', o.invoice_number,
    'status', o.status,
    'total_amount', o.total_amount,
    'tracking_number', o.tracking_number,
    'tracking_vendor', o.tracking_vendor,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'shipping_address', json_build_object(
      'city', COALESCE(o.shipping_address->>'city', ''),
      'state', COALESCE(o.shipping_address->>'state', '')
    ),
    'items', COALESCE((
      SELECT json_agg(json_build_object(
        'name', p.name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price
      ))
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = o.id
    ), '[]'::json)
  )
  FROM orders o
  WHERE UPPER(TRIM(o.invoice_number)) = UPPER(TRIM(inv_number))
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

DROP POLICY IF EXISTS "Admin can read all orders" ON orders;
CREATE POLICY "Admin can read all orders" ON orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can update orders" ON orders;
CREATE POLICY "Admin can update orders" ON orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════
-- PROFILES — admin can read all (for order customer info)
-- ══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admin can read all profiles" ON profiles;
CREATE POLICY "Admin can read all profiles" ON profiles FOR SELECT TO authenticated USING (true);

-- Add email column to profiles (email lives in auth.users, mirror it here for easy joins)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill email from auth.users into profiles
UPDATE profiles SET email = u.email
FROM auth.users u WHERE profiles.id = u.id AND (profiles.email IS NULL OR profiles.email = '');

-- Auto-sync email on new user signup (update the trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Direct FK from orders → profiles so Supabase can auto-join them
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_profiles') THEN
    ALTER TABLE orders ADD CONSTRAINT fk_orders_profiles FOREIGN KEY (user_id) REFERENCES profiles(id);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- ORDER ITEMS — admin can read all (for order product details)
-- ══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admin can read all order items" ON order_items;
CREATE POLICY "Admin can read all order items" ON order_items FOR SELECT TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════════════
-- USER ADDRESSES — admin can read all (for order shipping info)
-- ══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admin can read all addresses" ON user_addresses;
CREATE POLICY "Admin can read all addresses" ON user_addresses FOR SELECT TO authenticated USING (true);
