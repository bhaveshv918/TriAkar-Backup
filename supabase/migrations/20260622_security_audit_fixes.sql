-- TriAkar — Security audit fixes
-- Run in Supabase SQL Editor. All statements are idempotent / safe to re-run.
-- Date: 2026-06-22

-- ════════════════════════════════════════════════════════════════════════
-- 1. PROMO CODES — remove the public "read all active codes" policy.
--    rls_policies.sql created  promo_codes_select_active  (FOR SELECT, public)
--    which OR's with the admin-only policy added later, so anyone holding the
--    public anon key could still enumerate every active discount code via
--    GET /rest/v1/promo_codes?is_active=eq.true. Checkout still works because
--    the Express backend validates promos with the service_role key (bypasses RLS).
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "promo_codes_select_active" ON promo_codes;
DROP POLICY IF EXISTS "Anyone reads active promos"  ON promo_codes;
DROP POLICY IF EXISTS "Auth users read promos"      ON promo_codes;

-- Re-assert the admin-only policy (idempotent).
DROP POLICY IF EXISTS "promo_codes_admin_only" ON promo_codes;
CREATE POLICY "promo_codes_admin_only" ON promo_codes
  FOR ALL TO authenticated
  USING     (auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK(auth.email() = 'bhaveshv918@gmail.com');

-- ════════════════════════════════════════════════════════════════════════
-- 2. PHONE_OTPS — add an attempt counter so the verify endpoints can lock a
--    code after repeated wrong guesses (brute-force protection). The Express
--    handlers tolerate this column being absent, but adding it activates the cap.
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE phone_otps ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
