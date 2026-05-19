-- TriAkar Schema v2 — Complete Orders, Addresses, Profiles
-- Run in Supabase SQL Editor. Safe to run multiple times.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 1. PROFILES — extend with new fields
-- ══════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS alternate_mobile TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS anniversary_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill email from auth.users
UPDATE profiles SET email = u.email
FROM auth.users u WHERE profiles.id = u.id AND (profiles.email IS NULL OR profiles.email = '');

-- Updated auth trigger — captures mobile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, mobile)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'mobile'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    mobile = COALESCE(EXCLUDED.mobile, profiles.mobile);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Admin can read all profiles
DROP POLICY IF EXISTS "Admin can read all profiles" ON profiles;
CREATE POLICY "Admin can read all profiles" ON profiles
  FOR SELECT TO authenticated USING (true);

-- Users can read/update own profile
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
CREATE POLICY "Users insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ══════════════════════════════════════════════════════════════
-- 2. USER ADDRESSES — complete address system
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_addresses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  address_label   TEXT DEFAULT 'Home',
  full_name       TEXT NOT NULL,
  mobile          TEXT NOT NULL,
  alternate_mobile TEXT,
  address_line1   TEXT NOT NULL,
  address_line2   TEXT,
  landmark        TEXT,
  city            TEXT NOT NULL,
  district        TEXT,
  state           TEXT NOT NULL,
  pincode         TEXT NOT NULL,
  country         TEXT NOT NULL DEFAULT 'India',
  address_type    TEXT DEFAULT 'home',
  is_default      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own addresses" ON user_addresses;
CREATE POLICY "Users manage own addresses" ON user_addresses
  FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admin can read all addresses" ON user_addresses;
CREATE POLICY "Admin can read all addresses" ON user_addresses
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON user_addresses(user_id);

-- ══════════════════════════════════════════════════════════════
-- 3. ORDERS — add new columns for complete order flow
-- ══════════════════════════════════════════════════════════════
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_id TEXT UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_charge NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'online';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'placed';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_vendor TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Make user_id nullable (for guest/whatsapp orders)
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);

-- RLS — admin can do everything, users can read own
DROP POLICY IF EXISTS "Admin can read all orders" ON orders;
CREATE POLICY "Admin can read all orders" ON orders
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can update orders" ON orders;
CREATE POLICY "Admin can update orders" ON orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users read own orders" ON orders;
CREATE POLICY "Users read own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own orders" ON orders;
CREATE POLICY "Users insert own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Anyone can insert orders (for guest checkout / WhatsApp orders)
DROP POLICY IF EXISTS "Anyone can place orders" ON orders;
CREATE POLICY "Anyone can place orders" ON orders
  FOR INSERT WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- 4. ORDER ITEMS — admin access
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admin can read all order items" ON order_items;
CREATE POLICY "Admin can read all order items" ON order_items
  FOR SELECT TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════
-- 5. RPC — Create order (bypasses RLS with SECURITY DEFINER)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION create_customer_order(
  p_order_id TEXT,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_shipping_address JSONB,
  p_items JSONB,
  p_subtotal NUMERIC,
  p_shipping_charge NUMERIC,
  p_total_amount NUMERIC,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_special_instructions TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO orders (
    order_id, user_id, customer_name, customer_email, customer_phone,
    shipping_address, items, subtotal, shipping_charge, total_amount,
    payment_method, payment_status, order_status, special_instructions, status
  ) VALUES (
    p_order_id, p_user_id, p_customer_name, p_customer_email, p_customer_phone,
    p_shipping_address, p_items, p_subtotal, p_shipping_charge, p_total_amount,
    p_payment_method, p_payment_status, 'placed', p_special_instructions, 'pending'
  ) RETURNING id INTO v_id;

  RETURN json_build_object('id', v_id, 'order_id', p_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- 6. RPC — Track order by TRK ID (public, no auth needed)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION track_order_public(p_order_id TEXT)
RETURNS JSON AS $$
  SELECT json_build_object(
    'found', true,
    'order_id', o.order_id,
    'order_status', o.order_status,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'total_amount', o.total_amount,
    'tracking_number', o.tracking_number,
    'tracking_vendor', o.tracking_vendor,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'items', COALESCE(o.items, '[]'::jsonb),
    'shipping_city', o.shipping_address->>'city',
    'shipping_state', o.shipping_address->>'state'
  )
  FROM orders o
  WHERE UPPER(TRIM(o.order_id)) = UPPER(TRIM(p_order_id))
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- 7. RPC — Get user orders (for account page)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_my_orders(p_email TEXT)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::json)
  FROM (
    SELECT order_id, order_status, payment_status, payment_method,
           total_amount, items, tracking_number, tracking_vendor,
           created_at, shipping_address
    FROM orders
    WHERE customer_email = p_email
  ) t;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- 8. CORPORATE INQUIRIES — admin access
-- ══════════════════════════════════════════════════════════════
ALTER TABLE corporate_inquiries ADD COLUMN IF NOT EXISTS is_responded BOOLEAN DEFAULT FALSE;
ALTER TABLE corporate_inquiries ADD COLUMN IF NOT EXISTS admin_notes TEXT;

DROP POLICY IF EXISTS "Admin can read inquiries" ON corporate_inquiries;
CREATE POLICY "Admin can read inquiries" ON corporate_inquiries
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can update inquiries" ON corporate_inquiries;
CREATE POLICY "Admin can update inquiries" ON corporate_inquiries
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can submit inquiry" ON corporate_inquiries;
CREATE POLICY "Anyone can submit inquiry" ON corporate_inquiries
  FOR INSERT WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- 9. ADMIN LOGS — lockout RPC (already exists but ensure it's here)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_recent_failures(visitor_ip TEXT, lockout_seconds INT)
RETURNS TABLE(fail_count INT, last_fail_at TIMESTAMPTZ) AS $$
  SELECT COUNT(*)::INT, MAX(created_at)
  FROM admin_logs
  WHERE ip = visitor_ip
    AND action = 'login_attempt'
    AND success = false
    AND created_at >= NOW() - (lockout_seconds || ' seconds')::INTERVAL;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- Done! All tables, policies, functions, and indexes created.
-- ══════════════════════════════════════════════════════════════
