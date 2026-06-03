-- TriAkar — Supabase / PostgreSQL schema
-- Fully idempotent — safe to run multiple times.
-- Run this in Supabase SQL Editor.

-- ════════════════════════════════════════════════════════════════════════
-- 1. DROP dependents first (reverse dependency order)
-- ════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS order_items         CASCADE;
DROP TABLE IF EXISTS orders              CASCADE;
DROP TABLE IF EXISTS carts               CASCADE;
DROP TABLE IF EXISTS user_addresses      CASCADE;
DROP TABLE IF EXISTS products            CASCADE;
DROP TABLE IF EXISTS profiles            CASCADE;
DROP TABLE IF EXISTS corporate_inquiries CASCADE;
DROP TABLE IF EXISTS contact_submissions CASCADE;
DROP TABLE IF EXISTS admin_logs          CASCADE;
DROP TABLE IF EXISTS categories          CASCADE;
DROP TABLE IF EXISTS custom_enquiries    CASCADE;
DROP TABLE IF EXISTS callback_requests   CASCADE;
DROP TYPE  IF EXISTS order_status        CASCADE;

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
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
-- TEMPORARY: remove once admin reads are served through Express /api/admin/* routes
CREATE POLICY "Admin manages profiles" ON profiles FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

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
  landmark      TEXT,
  district      TEXT,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  pincode       TEXT NOT NULL,
  country       TEXT NOT NULL DEFAULT 'India',
  is_default    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Migration helper: add landmark/district to existing deployments without full re-create
-- Run these two lines in Supabase SQL Editor if the table already exists:
-- ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS landmark TEXT;
-- ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own addresses" ON user_addresses FOR ALL USING (auth.uid() = user_id);
-- TEMPORARY: remove once admin reads are served through Express /api/admin/* routes
CREATE POLICY "Admin manages addresses" ON user_addresses FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

-- ════════════════════════════════════════════════════════════════════════
-- 4. PRODUCTS
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE products (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  slug                     TEXT NOT NULL UNIQUE,
  description              TEXT,
  short_description        TEXT,
  long_description         TEXT,
  price                    NUMERIC(10,2) NOT NULL,
  category                 TEXT NOT NULL,
  material                 TEXT DEFAULT 'PLA+',
  sku                      TEXT,
  designer                 TEXT,
  stock_qty                INTEGER NOT NULL DEFAULT 0,
  stock_status             TEXT DEFAULT 'Made to Order',
  images                   TEXT[] DEFAULT '{}',
  is_customizable          BOOLEAN DEFAULT false,
  is_active                BOOLEAN DEFAULT true,
  is_bestseller            BOOLEAN DEFAULT false,
  is_featured              BOOLEAN DEFAULT false,
  badge                    TEXT,
  urgency_type             TEXT,
  urgency_text             TEXT,
  bullet_points            JSONB DEFAULT '[]',
  key_features             TEXT,
  customization_options    TEXT,
  customization_fields     JSONB DEFAULT '[]',
  dimensions               TEXT,
  target_audience          TEXT,
  use_case                 TEXT,
  tags                     TEXT,
  discount_type            TEXT,
  discount_value           NUMERIC(10,2) DEFAULT 0,
  description_display_mode TEXT DEFAULT 'all',
  notes                    TEXT,
  variants                 JSONB DEFAULT '[]',
  product_dropdowns        JSONB DEFAULT '[]',
  colors                   TEXT[] DEFAULT '{}',
  homepage_order           INTEGER,
  -- v2 unified fields
  product_options          JSONB DEFAULT '[]',
  specifications           JSONB DEFAULT '[]',
  min_order_qty            INTEGER,
  qty_step                 INTEGER,
  key_features_label       TEXT,
  created_at               TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active products" ON products FOR SELECT USING (is_active = true);
-- TEMPORARY: remove once admin writes are served through Express /api/admin/* routes with service_role key
CREATE POLICY "Admin manages products" ON products FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

-- Migration helper: add new columns to an existing products table without full re-create.
-- Run these in Supabase SQL Editor if the table already exists:
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS long_description TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS material TEXT DEFAULT 'PLA+';
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS designer TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_status TEXT DEFAULT 'Made to Order';
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT false;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS badge TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS urgency_type TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS urgency_text TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS bullet_points JSONB DEFAULT '[]';
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS key_features TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS customization_options TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS customization_fields JSONB DEFAULT '[]';
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS target_audience TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS use_case TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_type TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 0;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS description_display_mode TEXT DEFAULT 'all';
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS notes TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]';
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS product_options JSONB DEFAULT '[]';
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '[]';
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS min_order_qty INTEGER;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS qty_step INTEGER;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS key_features_label TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS product_dropdowns JSONB DEFAULT '[]';
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS colors TEXT[] DEFAULT '{}';
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS homepage_order INTEGER;

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
CREATE POLICY "Users update own orders" ON orders FOR UPDATE USING (auth.uid() = user_id);
-- TEMPORARY: remove once admin reads/writes are served through Express /api/admin/* routes
CREATE POLICY "Admin manages orders" ON orders FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

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
CREATE POLICY "Users insert own order items" ON order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND orders.user_id = auth.uid()));
-- TEMPORARY: remove once admin reads are served through Express /api/admin/* routes
CREATE POLICY "Admin manages order items" ON order_items FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

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
-- TEMPORARY: remove once admin reads are served through Express /api/admin/* routes
CREATE POLICY "Admin manages carts" ON carts FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

-- ════════════════════════════════════════════════════════════════════════
-- 8. CORPORATE INQUIRIES (public insert, admin-only read)
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
ALTER TABLE corporate_inquiries ENABLE ROW LEVEL SECURITY;
-- Anyone (including anonymous visitors) can submit an inquiry via the website form.
-- Only the admin can read or manage submitted inquiries.
CREATE POLICY "Anyone submits inquiry" ON corporate_inquiries
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manages inquiries" ON corporate_inquiries FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

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
  ('Bulk Custom Order',   'bulk-gifting',  'Bulk corporate gifting with custom branding',              180, 'gifting', 999,  true),
  ('Mini Keychain',        'mini-keychain','Compact 3D-printed keychain with minimal geometric design', 119, 'decor',  200,  false)
ON CONFLICT (slug) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════
-- 13. ORDERS — MIGRATION: add columns added after initial deploy
-- Run these in Supabase SQL Editor if the table already exists:
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2);
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_charge NUMERIC(10,2);
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS special_instructions TEXT;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_id TEXT;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- 14. PROMO CODES
-- ════════════════════════════════════════════════════════════════════════
-- (section continues below)

-- ════════════════════════════════════════════════════════════════════════
-- 15. REVIEWS
-- Run this block in Supabase SQL Editor to add the reviews table.
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reviews (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug      TEXT        NOT NULL,
  product_name      TEXT,
  user_id           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name     TEXT        NOT NULL,
  reviewer_email    TEXT,
  rating            INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review            TEXT        NOT NULL,
  images            TEXT[]      DEFAULT '{}',
  verified_purchase BOOLEAN     DEFAULT false,
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','rejected')),
  admin_note        TEXT,
  source            TEXT        DEFAULT 'website',
  city              TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public: read approved reviews only
CREATE POLICY "Anyone reads approved reviews" ON reviews
  FOR SELECT USING (status = 'approved');

-- Authenticated users can submit reviews
CREATE POLICY "Auth users insert reviews" ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Admin: full access
CREATE POLICY "Admin manages reviews" ON reviews
  FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

-- Migration helper: add reviews table to an existing deployment without full re-create
-- ALTER TABLE reviews ADD COLUMN IF NOT EXISTS product_name TEXT;
-- ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_note TEXT;
-- ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website';
-- ALTER TABLE reviews ADD COLUMN IF NOT EXISTS city TEXT;
-- ALTER TABLE reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ════════════════════════════════════════════════════════════════════════
-- 16. CATEGORIES
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  display_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active categories" ON categories
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admin manages categories" ON categories FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

-- ════════════════════════════════════════════════════════════════════════
-- 17. ADMIN LOGS
-- Stores page-visit and auth-attempt events from admin.html.
-- Write is open (anon visitors trigger pre-login events); reads are admin-only.
-- FUTURE: move write to the Express backend so anon INSERT can be removed.
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_logs (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  action         TEXT,
  ip             TEXT,
  user_agent     TEXT,
  screen_res     TEXT,
  timezone       TEXT,
  language       TEXT,
  platform       TEXT,
  referrer       TEXT,
  email_attempted TEXT,
  success        BOOLEAN,
  extra          JSONB   DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
-- Pre-login visit/failure events are written before a JWT exists.
-- FUTURE: restrict to authenticated only once admin.html writes via Express API.
CREATE POLICY "Anyone inserts log" ON admin_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manages logs" ON admin_logs FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

-- ════════════════════════════════════════════════════════════════════════
-- 18. CONTACT SUBMISSIONS
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contact_submissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT,
  email      TEXT,
  phone      TEXT,
  subject    TEXT,
  message    TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
-- Anyone can submit a contact form.
CREATE POLICY "Anyone submits contact" ON contact_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manages contact submissions" ON contact_submissions FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

-- ════════════════════════════════════════════════════════════════════════
-- 19. CUSTOM ENQUIRIES
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS custom_enquiries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id        TEXT,
  name                TEXT,
  email               TEXT,
  phone               TEXT,
  what_needed         TEXT,
  budget_range        TEXT,
  material_preference TEXT,
  is_read             BOOLEAN DEFAULT false,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE custom_enquiries ENABLE ROW LEVEL SECURITY;
-- Anyone can submit a custom enquiry from the website.
CREATE POLICY "Anyone submits enquiry" ON custom_enquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manages enquiries" ON custom_enquiries FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

-- ════════════════════════════════════════════════════════════════════════
-- 20. CALLBACK REQUESTS
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS callback_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id   TEXT,
  name           TEXT,
  phone          TEXT,
  topic          TEXT,
  preferred_time TEXT,
  is_called      BOOLEAN DEFAULT false,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE callback_requests ENABLE ROW LEVEL SECURITY;
-- Anyone can request a callback.
CREATE POLICY "Anyone submits callback" ON callback_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manages callbacks" ON callback_requests FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');
CREATE TABLE IF NOT EXISTS promo_codes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT UNIQUE NOT NULL,
  description      TEXT,
  discount_type    TEXT NOT NULL CHECK (discount_type IN ('free_shipping','percent','fixed')),
  discount_value   NUMERIC(10,2) DEFAULT 0,
  min_order_amount NUMERIC(10,2) DEFAULT 0,
  max_uses         INTEGER,
  current_uses     INTEGER DEFAULT 0,
  product_slug     TEXT,
  is_active        BOOLEAN DEFAULT true,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
-- Authenticated users can read all promo codes (needed for admin panel + checkout validation)
CREATE POLICY "Auth users read promos" ON promo_codes
  FOR SELECT USING (auth.role() = 'authenticated');
-- Admin user has full write access (INSERT / UPDATE / DELETE) via Supabase client
CREATE POLICY "Admin write promos" ON promo_codes
  FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');
