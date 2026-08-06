-- TriAkar — extend Business OS staff access (is_biz_staff() OR admin) to tables
-- created AFTER 20260703_biz_staff_access.sql, which were never added to that
-- migration's table list. Under RLS, these still carry a single-admin-email-only
-- FOR ALL policy, so a role='staff' account gets silently empty reads (no error)
-- and silently no-op writes on: biz_sale_payments, biz_rack_items, biz_printers,
-- biz_print_attempts, biz_invoices, biz_quotations, biz_gst_filings,
-- biz_filament_resales.
--
-- Same design/tradeoff disclosed in 20260703_biz_staff_access.sql applies here
-- (table-level, not tab-level, access — see that file's header comment).
--
-- Idempotent — safe to run multiple times.
-- ════════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
  biz_tables TEXT[] := ARRAY[
    'biz_sale_payments','biz_rack_items','biz_printers','biz_print_attempts',
    'biz_invoices','biz_quotations','biz_gst_filings','biz_filament_resales'
  ];
BEGIN
  FOREACH t IN ARRAY biz_tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "biz_staff_or_admin" ON public.%I', t);
      -- Drop whatever admin-only policy already exists on this table (names vary),
      -- same introspect-and-drop approach as the original staff-access migration.
      EXECUTE (
        SELECT COALESCE(string_agg(
          format('DROP POLICY IF EXISTS %I ON public.%I;', policyname, t), ' '
        ), '')
        FROM pg_policies WHERE schemaname='public' AND tablename=t
          AND qual ILIKE '%bhaveshv918@gmail.com%'
      );
      EXECUTE format(
        'CREATE POLICY "biz_staff_or_admin" ON public.%I FOR ALL TO authenticated
           USING ((SELECT auth.email())=''bhaveshv918@gmail.com'' OR public.is_biz_staff())
           WITH CHECK ((SELECT auth.email())=''bhaveshv918@gmail.com'' OR public.is_biz_staff())',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT tablename, policyname, qual FROM pg_policies
--   WHERE schemaname='public' AND tablename IN (
--     'biz_sale_payments','biz_rack_items','biz_printers','biz_print_attempts',
--     'biz_invoices','biz_quotations','biz_gst_filings','biz_filament_resales'
--   ) ORDER BY tablename;
-- ════════════════════════════════════════════════════════════════════════════════
