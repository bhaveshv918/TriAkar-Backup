-- biz_gst_filings.return_type check constraint only allowed 'gstr1'/'gstr3b',
-- but the GST reminder overhaul (admin-biz.html) added a GSTR-2B upload/mark-reviewed
-- flow that sends 'gstr2b'. Every save attempt fails live with
-- "new row for relation biz_gst_filings violates check constraint
-- biz_gst_filings_return_type_check". Widen the constraint to match.
--
-- Safe, additive. Run once in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE biz_gst_filings DROP CONSTRAINT IF EXISTS biz_gst_filings_return_type_check;
ALTER TABLE biz_gst_filings ADD CONSTRAINT biz_gst_filings_return_type_check
  CHECK (return_type IN ('gstr1','gstr3b','gstr2b'));

DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    INSERT INTO schema_migrations (filename) VALUES ('20260724_gst_filings_allow_gstr2b.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END $$;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'biz_gst_filings_return_type_check';
-- ════════════════════════════════════════════════════════════════════════════════
