-- TriAkar Business OS — editable customer records (B7)
-- 2026-06-25. The Customers tab still auto-builds stats from biz_sales; this table
-- adds canonical, editable details (GSTIN, country code, corrected name/address,
-- reviewed flag) merged in by phone/name. Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS biz_customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  country_code  TEXT DEFAULT '+91',
  phone         TEXT,
  gstin         TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  pincode       TEXT,
  reviewed      BOOLEAN DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_customers_phone_idx ON biz_customers(phone);

ALTER TABLE biz_customers ENABLE ROW LEVEL SECURITY;
-- Same admin-only policy shape as the other biz_* tables.
CREATE POLICY "biz_admin_only_customers" ON biz_customers
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');
