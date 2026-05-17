-- TriAkar — Supabase / PostgreSQL schema
-- Fully idempotent — safe to run multiple times.
-- Run this in Supabase SQL Editor.

-- ════════════════════════════════════════════════════════════════════════
-- 1. DROP dependents first (reverse dependency order)
-- ════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS order_items    CASCADE;
DROP TABLE IF EXISTS orders         CASCADE;
DROP TABLE IF EXISTS carts          CASCADE;
DROP TABLE IF EXISTS user_addresses CASCADE;
DROP TABLE IF EXISTS products       CASCADE;
DROP TABLE IF EXISTS profiles       CASCADE;
DROP TABLE IF EXISTS corporate_inquiries CASCADE;
DROP TYPE  IF EXISTS order_status   CASCADE;

-- ════════════════════════════════════════════════════════════════════════
-- 2. PROFILES
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  phone      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ════════════════════════════════════════════════════════════════════════
-- 3. USER ADDRESSES
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE user_addresses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  pincode       TEXT NOT NULL,
  country       TEXT NOT NULL DEFAULT 'India',
  is_default    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own addresses" ON user_addresses FOR ALL USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════
-- 4. PRODUCTS
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  price           NUMERIC(10,2) NOT NULL,
  category        TEXT NOT NULL,
  stock_qty       INTEGER NOT NULL DEFAULT 0,
  images          TEXT[] DEFAULT '{}',
  is_customizable BOOLEAN DEFAULT false,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active products" ON products FOR SELECT USING (is_active = true);

-- ════════════════════════════════════════════════════════════════════════
-- 5. ORDERS
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE orders (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  address_id               UUID REFERENCES user_addresses(id),
  status                   TEXT NOT NULL DEFAULT 'pending',
  total_amount             NUMERIC(10,2) NOT NULL,
  razorpay_order_id        TEXT,
  razorpay_payment_id      TEXT,
  shipping_address         JSONB DEFAULT '{}',
  created_at               TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own orders"   ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════
-- 6. ORDER ITEMS
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  unit_price          NUMERIC(10,2) NOT NULL,
  customization_notes TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own order items" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND orders.user_id = auth.uid()));

-- ════════════════════════════════════════════════════════════════════════
-- 7. CARTS (JSONB-based, one row per user)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE carts (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  items      JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cart" ON carts FOR ALL USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════
-- 8. CORPORATE INQUIRIES (public insert, no auth needed)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE corporate_inquiries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name     TEXT,
  contact_name     TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  message          TEXT,
  product_interest TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════
-- 9. AUTO-CREATE PROFILE ON SIGNUP
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ════════════════════════════════════════════════════════════════════════
-- 10. STOCK DECREMENT RPC
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_qty INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE products SET stock_qty = GREATEST(0, stock_qty - p_qty)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════════
-- 11. BACKFILL: create profile rows for any existing auth.users
-- ════════════════════════════════════════════════════════════════════════
INSERT INTO public.profiles (id, full_name)
SELECT id, raw_user_meta_data->>'full_name'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════
-- 12. SEED PRODUCTS
-- ════════════════════════════════════════════════════════════════════════
INSERT INTO products (name, slug, description, price, category, stock_qty, is_customizable) VALUES
  ('Arc Desk Organizer',  'arc-desk',       'Premium 3D-printed desk organizer with arc design',       1890, 'desk',    50,  false),
  ('Cable Loop',          'cable-loop',     'Minimal cable management solution for clean desks',        490, 'desk',   100,  false),
  ('Lean Stand',          'lean-stand',     'Sleek minimalist phone and tablet stand',                  890, 'desk',    75,  false),
  ('Stack Cardholder',    'stack-card',     'Modern business card holder with stacked design',          690, 'desk',    80,  false),
  ('Minimal Pen Tray',   'pen-tray',       'Clean geometric pen and stationery tray',                  590, 'desk',    90,  false),
  ('Monitor Riser',       'monitor-riser', 'Elevated monitor stand with storage underneath',          1490, 'desk',    40,  false),
  ('Facet Vase',          'facet-vase',    'Geometric faceted vase for modern home decor',            1290, 'decor',   60,  false),
  ('Arc Planter',         'arc-planter',   'Curved minimal planter for small indoor plants',           990, 'decor',   55,  false),
  ('Minimal Wall Hook',   'wall-hook',     'Clean wall-mounted hook for coats and bags',               390, 'decor',  120,  false),
  ('Bedside Phone Dock',  'phone-dock',    'Bedside charging dock with cable management',              790, 'decor',   70,  false),
  ('Candle Stand',        'candle-stand',  'Geometric candle holder for ambient lighting',             850, 'decor',   65,  false),
  ('Custom Name Plate',   'name-plate',    'Personalised name plate for home or office door',          750, 'custom', 999,  true),
  ('Signature Gift Box',  'gift-box',      'Premium curated gift box with custom 3D-printed items',  1490, 'gifting',  30,  true),
  ('Bookmark Set',        'bookmark-set',  'Set of 4 minimal 3D-printed bookmarks',                   450, 'gifting', 150,  false),
  ('Coaster Set',         'coaster-set',   'Set of 4 geometric coasters for home or gifting',          680, 'gifting', 100,  false),
  ('Custom Replacement',  'custom-bracket','Custom replacement part printed to your specs',            299, 'custom', 999,  true),
  ('Functional Prototype','prototype',     'Rapid prototype printing for your product idea',           499, 'custom', 999,  true),
  ('Bulk Custom Order',   'bulk-gifting',  'Bulk corporate gifting with custom branding',              180, 'gifting', 999,  true)
ON CONFLICT (slug) DO NOTHING;
