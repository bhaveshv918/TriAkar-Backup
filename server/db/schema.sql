-- TriAkar — Supabase / PostgreSQL schema
-- Run this in the Supabase SQL editor to set up all tables.

-- ── PROFILES ───────────────────────────────────────────────────────────────
-- Extends Supabase Auth users with additional fields.
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── PRODUCTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  price           NUMERIC(10,2) NOT NULL,
  category        TEXT NOT NULL,        -- desk | home | gifting | custom
  stock_qty       INTEGER NOT NULL DEFAULT 0,
  images          TEXT[] DEFAULT '{}',  -- Supabase Storage URLs
  is_customizable BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active products" ON products FOR SELECT USING (is_active = TRUE);

-- ── ORDERS ─────────────────────────────────────────────────────────────────
CREATE TYPE order_status AS ENUM ('pending','confirmed','processing','shipped','delivered','cancelled');

CREATE TABLE IF NOT EXISTS orders (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status                   order_status NOT NULL DEFAULT 'pending',
  total_amount             NUMERIC(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  shipping_address         JSONB DEFAULT '{}',
  created_at               TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own orders"   ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── ORDER ITEMS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id           UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity             INTEGER NOT NULL CHECK (quantity > 0),
  unit_price           NUMERIC(10,2) NOT NULL,
  customization_notes  TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own order items" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND orders.user_id = auth.uid()));

-- ── CARTS ──────────────────────────────────────────────────────────────────
-- One cart per user, items stored as JSONB for simplicity.
CREATE TABLE IF NOT EXISTS carts (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  items      JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own cart" ON carts FOR ALL USING (auth.uid() = user_id);

-- ── CORPORATE INQUIRIES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS corporate_inquiries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name     TEXT,
  contact_name     TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  message          TEXT,
  product_interest TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
-- No RLS — service role only (submitted via server, not direct client)

-- ── STOCK DECREMENT RPC ────────────────────────────────────────────────────
-- Called by the webhook after payment succeeds to safely decrement stock.
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock_qty = GREATEST(0, stock_qty - p_qty)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
