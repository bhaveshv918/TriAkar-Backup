-- TriAkar — Business OS staff accounts with granular per-tab UI permissions.
--
-- Design (confirmed with user): staff can ONLY log into Business OS (never admin.html).
-- Tab-level restriction is enforced in the UI (sidebar only shows/allows permitted
-- tabs) — at the DATABASE layer, any staff-role account gets the SAME broad access as
-- the owner on biz_* tables. Building true per-table/per-tab RLS would mean mapping
-- every one of ~20 tabs to specific table-row policies — a much bigger undertaking than
-- what "tab-level permission control" asks for, and this app has exactly one trusted
-- owner adding a small number of known staff, not an adversarial multi-tenant setup.
-- This is disclosed to the user directly, not silently assumed.
--
-- Idempotent — safe to run multiple times.
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS biz_tabs JSONB DEFAULT '[]'::jsonb;

-- SECURITY DEFINER so it can be safely called from inside another table's RLS policy
-- without re-triggering profiles' own RLS recursively.
CREATE OR REPLACE FUNCTION public.is_biz_staff()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'staff'
  );
$$;

-- ── Widen every Business OS table's RLS to admin OR staff ──────────────────────────
DO $$
DECLARE
  t TEXT;
  biz_tables TEXT[] := ARRAY[
    'biz_channels','biz_products','biz_sales','biz_returns','biz_stock_movements',
    'biz_customers','biz_expenses','biz_filament_rolls','filament_inventory',
    'biz_activity_log','biz_income','biz_purchases','biz_shop_log'
  ];
BEGIN
  FOREACH t IN ARRAY biz_tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "biz_staff_or_admin" ON public.%I', t);
      -- Drop whatever admin-only policy already exists on this table (names vary:
      -- biz_admin_only_<name>, or table-specific — introspect and drop all FOR ALL
      -- policies restricted to the single admin email, then recreate widened).
      EXECUTE (
        SELECT COALESCE(string_agg(
          format('DROP POLICY IF EXISTS %I ON public.%I;', polname, t), ' '
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

-- ── Storage: biz-invoices bucket (Expenses/Purchases invoice uploads) ──────────────
DROP POLICY IF EXISTS "biz_invoices_admin_only" ON storage.objects;
DROP POLICY IF EXISTS "biz_invoices_staff_or_admin" ON storage.objects;
CREATE POLICY "biz_invoices_staff_or_admin" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'biz-invoices' AND ((SELECT auth.email())='bhaveshv918@gmail.com' OR public.is_biz_staff()))
  WITH CHECK (bucket_id = 'biz-invoices' AND ((SELECT auth.email())='bhaveshv918@gmail.com' OR public.is_biz_staff()));

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT tablename, policyname, qual FROM pg_policies
--   WHERE schemaname='public' AND tablename LIKE 'biz_%' ORDER BY tablename;
-- (as a staff user) SELECT * FROM biz_sales LIMIT 1; -- should succeed once role='staff'
-- ════════════════════════════════════════════════════════════════════════════════
