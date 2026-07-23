-- TriAkar Business OS: three follow-ups from the Phase 10 deep-pass review.
--
-- 1. Universal Record ID extended from Orders/Quotations to Expenses,
--    Purchases, Returns, and Customers (A1 was originally described as
--    applying to "every entry type" but only covered two).
-- 2. schema_migrations tracking table, self-registering, so future sessions
--    can check "has migration X actually run" with a plain SELECT instead of
--    anon-probing tables or asking the user to confirm by hand every time.
-- 3. Standardized REVOKE EXECUTE FROM PUBLIC for every SECURITY DEFINER
--    function flagged in the anon-execute security audit earlier this
--    project (purge_old_recycle_bin, gen_record_id,
--    biz_next_quotation_number, biz_next_invoice_number). REVOKE is
--    idempotent, safe to run even if already applied by hand.
--
-- Safe, additive. Run once in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Record ID columns, extended ─────────────────────────────────────────────────
ALTER TABLE biz_expenses  ADD COLUMN IF NOT EXISTS record_id TEXT;
ALTER TABLE biz_purchases ADD COLUMN IF NOT EXISTS record_id TEXT;
ALTER TABLE biz_returns   ADD COLUMN IF NOT EXISTS record_id TEXT;
ALTER TABLE biz_customers ADD COLUMN IF NOT EXISTS record_id TEXT;

-- 2. Migration tracking ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_schema_migrations" ON schema_migrations;
CREATE POLICY "biz_admin_only_schema_migrations" ON schema_migrations
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com');

-- Backfill: register every migration that predates this tracking table so the
-- ledger starts complete, not just going forward. Best-effort list built from
-- the migrations/ directory at the time this file was written; harmless if a
-- filename here doesn't match exactly, it just won't get an entry.
INSERT INTO schema_migrations (filename) VALUES
  ('20260721_phase10_orders_quotations.sql'),
  ('20260721_rack_inventory.sql'),
  ('20260723_record_id_extension_and_hardening.sql')
ON CONFLICT (filename) DO NOTHING;

-- 3. Standardized anon-execute hardening ──────────────────────────────────────────
-- REVOKE is a no-op if already run by hand after the security-audit round
-- earlier this project; safe either way.
REVOKE EXECUTE ON FUNCTION purge_old_recycle_bin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION gen_record_id(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION biz_next_quotation_number(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION biz_next_invoice_number(TEXT) FROM PUBLIC;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name IN
--   ('biz_expenses','biz_purchases','biz_returns','biz_customers') AND column_name='record_id';
-- SELECT * FROM schema_migrations ORDER BY filename;
-- SELECT proname, proacl FROM pg_proc WHERE proname IN
--   ('purge_old_recycle_bin','gen_record_id','biz_next_quotation_number','biz_next_invoice_number');
--   (proacl should no longer show an entry granting execute to PUBLIC/"=X" once revoked)
-- ════════════════════════════════════════════════════════════════════════════════
