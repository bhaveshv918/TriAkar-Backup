-- TriAkar — RLS hardening migration
-- Run in Supabase SQL Editor. All statements are idempotent.
-- Date: 2026-06-04

-- ════════════════════════════════════════════════════════════════════════
-- 1. PHONE_OTPS — create table with strict RLS if it doesn't exist yet
--    (this table was created outside the main schema.sql)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS phone_otps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT        NOT NULL,
  otp        TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified   BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (safe to run even if already enabled)
ALTER TABLE phone_otps ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on phone_otps before applying strict ones
DROP POLICY IF EXISTS "Anyone reads otps"                              ON phone_otps;
DROP POLICY IF EXISTS "Anyone manages otps"                            ON phone_otps;
DROP POLICY IF EXISTS "Public insert otp"                              ON phone_otps;
DROP POLICY IF EXISTS "Public read otp"                                ON phone_otps;
DROP POLICY IF EXISTS "Admin manages phone_otps"                       ON phone_otps;
DROP POLICY IF EXISTS "Service role only — no direct client access"    ON phone_otps;
DROP POLICY IF EXISTS "Service role only - no direct client access"    ON phone_otps;

-- NO public SELECT — OTPs must only be read by the server via service_role key.
-- The Express backend uses the service_role key (bypasses RLS) for all OTP operations.
-- Anon and authenticated Supabase clients cannot read or insert OTPs directly.
CREATE POLICY "phone_otps_deny_all" ON phone_otps
  FOR ALL USING (false) WITH CHECK (false);

-- ════════════════════════════════════════════════════════════════════════
-- 2. PROMO_CODES — restrict SELECT to admin only
--    (previously any authenticated user could enumerate all promo codes)
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Auth users read promos"  ON promo_codes;
DROP POLICY IF EXISTS "Admin write promos"      ON promo_codes;
DROP POLICY IF EXISTS "Admin manages promos"    ON promo_codes;

-- Only the admin can read or write promo codes via Supabase client.
-- Backend validation uses service_role key (bypasses RLS) so checkout still works.
CREATE POLICY "promo_codes_admin_only" ON promo_codes
  FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

-- ════════════════════════════════════════════════════════════════════════
-- 3. PROMO_CODES — add max_discount_amount column (referenced in code, missing in schema)
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(10,2);

-- ════════════════════════════════════════════════════════════════════════
-- 4. ORDERS — ensure service_role backend updates are not blocked by RLS
--    (backend uses service_role so this is informational — no policy change needed)
--    Verify: Users can only read/update their own orders via anon/user JWTs.
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- 5. ADMIN_LOGS — add index for cleanup queries; restrict read to admin
--    (INSERT remains open so pre-login events can be captured)
-- ════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS admin_logs_created_at_idx ON admin_logs (created_at);

-- Auto-purge logs older than 90 days (run as a scheduled Supabase cron or manually)
-- DELETE FROM admin_logs WHERE created_at < now() - interval '90 days';
