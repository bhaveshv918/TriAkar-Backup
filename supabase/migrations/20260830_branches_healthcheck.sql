-- ════════════════════════════════════════════════════════════════════════════════
-- TriAkar, branch migration health check. Read only, changes nothing.
-- Run AFTER 20260830_branches.sql. Safe to run any time, as often as you like.
--
-- Two queries. Run them one at a time and export each result as CSV.
--   QUERY 1  every structural check, one row each, with a PASS / FAIL column
--   QUERY 2  row counts per table per branch, which is the one to keep as a
--            before/after record that no data moved or disappeared
-- ════════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════════
-- QUERY 1: structural checks
-- Sort so anything wrong floats to the top. Everything should say PASS.
-- ════════════════════════════════════════════════════════════════════════════════
WITH expected_tables(t) AS (VALUES
  ('biz_sales'),('biz_returns'),('biz_expenses'),('biz_income'),('biz_purchases'),
  ('biz_stock_movements'),('biz_rack_items'),('biz_printers'),('biz_print_attempts'),
  ('biz_invoices'),('biz_quotations'),('biz_sale_payments'),('biz_shop_log'),
  ('biz_customers'),('biz_filament_rolls'),('biz_filament_resales'),('filament_inventory'),
  ('biz_activity_log'),('orders')
),
-- Only tables that actually exist here. A table this project never created is not a
-- failure, so it is excluded from the denominator rather than counted as missing.
live AS (SELECT t FROM expected_tables WHERE to_regclass('public.'||t) IS NOT NULL),
scoped AS (SELECT t FROM live WHERE t NOT IN ('orders','biz_activity_log')),
checks(sort_key, check_name, expected, actual) AS (

  -- ── Branches ────────────────────────────────────────────────────────────────
  SELECT 1, 'Both branches exist', '2',
         (SELECT count(*)::text FROM biz_branches WHERE id IN ('noida','gurugram'))
  UNION ALL
  SELECT 2, 'Sohna pin is the one off Google', '28.2837480 / 77.0751219',
         (SELECT COALESCE(geo_lat::text,'null')||' / '||COALESCE(geo_lng::text,'null')
            FROM biz_branches WHERE id='gurugram')
  UNION ALL
  SELECT 3, 'Sohna is a branch, not a studio', 'branch / no walk-ins',
         (SELECT kind||' / '||CASE WHEN walk_ins THEN 'WALK-INS ON' ELSE 'no walk-ins' END
            FROM biz_branches WHERE id='gurugram')

  -- ── Pincode routing ─────────────────────────────────────────────────────────
  UNION ALL SELECT 4, 'Routing: 122103 Sohna',      'gurugram', branch_for_pincode('122103')
  UNION ALL SELECT 5, 'Routing: 122001 Gurgaon',    'gurugram', branch_for_pincode('122001')
  UNION ALL SELECT 6, 'Routing: 123401 Rewari',     'gurugram', branch_for_pincode('123401')
  UNION ALL SELECT 7, 'Routing: 201307 Noida Ext',  'noida',    branch_for_pincode('201307')
  UNION ALL SELECT 8, 'Routing: 110001 Delhi',      'noida',    branch_for_pincode('110001')
  UNION ALL SELECT 9, 'Routing: 400001 fallback',   'noida',    branch_for_pincode('400001')

  -- ── Helper functions ────────────────────────────────────────────────────────
  UNION ALL
  SELECT 10, 'Helper functions present', '5',
         (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname IN
             ('is_biz_owner','staff_branch','branch_for_pincode','biz_stamp_branch','biz_audit'))
  UNION ALL
  SELECT 11, 'profiles.branch_id exists', 'yes',
         (SELECT CASE WHEN count(*)>0 THEN 'yes' ELSE 'MISSING' END FROM information_schema.columns
           WHERE table_schema='public' AND table_name='profiles' AND column_name='branch_id')

  -- ── Columns, keys, indexes ──────────────────────────────────────────────────
  UNION ALL
  SELECT 12, 'branch_id column on every table', (SELECT count(*)::text FROM live),
         (SELECT count(*)::text FROM live l JOIN information_schema.columns c
            ON c.table_schema='public' AND c.table_name=l.t AND c.column_name='branch_id')
  UNION ALL
  SELECT 13, 'Tables still missing branch_id', 'none',
         COALESCE((SELECT string_agg(l.t, ', ' ORDER BY l.t) FROM live l
            WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema='public' AND c.table_name=l.t AND c.column_name='branch_id')), 'none')
  UNION ALL
  -- Scoped to the migrated tables on purpose. profiles and biz_branch_pincodes also
  -- carry a branch_id foreign key, and counting those too would make a healthy
  -- database look wrong.
  SELECT 14, 'Foreign key to biz_branches', (SELECT count(*)::text FROM live),
         (SELECT count(*)::text FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
           WHERE con.contype='f' AND rel.relname IN (SELECT t FROM live)
             AND con.conname LIKE '%branch_id_fkey')
  UNION ALL
  SELECT 15, 'Index on branch_id', (SELECT count(*)::text FROM live),
         (SELECT count(*)::text FROM pg_indexes
           WHERE schemaname='public' AND tablename IN (SELECT t FROM live)
             AND indexname LIKE '%branch_idx')

  -- ── Security. These are the ones that actually matter. ──────────────────────
  UNION ALL
  SELECT 16, 'Branch-scoped RLS policies', (SELECT count(*)::text FROM scoped),
         (SELECT count(*)::text FROM pg_policies
           WHERE schemaname='public' AND policyname='biz_branch_scoped')
  UNION ALL
  SELECT 17, 'Old email-only policies left behind', 'none',
         COALESCE((SELECT string_agg(DISTINCT tablename, ', ') FROM pg_policies
           WHERE schemaname='public' AND qual ILIKE '%bhaveshv918@gmail.com%'
             AND tablename IN (SELECT t FROM scoped)), 'none')
  UNION ALL
  SELECT 18, 'Staff policy on orders', 'yes',
         (SELECT CASE WHEN count(*)=1 THEN 'yes' ELSE 'MISSING' END FROM pg_policies
           WHERE schemaname='public' AND policyname='orders_branch_staff')
  UNION ALL
  SELECT 19, 'Staff policy on order_items', 'yes',
         (SELECT CASE WHEN count(*)=1 THEN 'yes' ELSE 'MISSING' END FROM pg_policies
           WHERE schemaname='public' AND policyname='order_items_branch_staff')
  UNION ALL
  SELECT 20, 'Customer order policies untouched', 'yes',
         (SELECT CASE WHEN count(*)>=1 THEN 'yes' ELSE 'GONE' END FROM pg_policies
           WHERE schemaname='public' AND tablename='orders' AND qual ILIKE '%user_id%')

  -- ── Triggers ────────────────────────────────────────────────────────────────
  UNION ALL
  SELECT 21, 'Branch stamp trigger', (SELECT count(*)::text FROM live),
         (SELECT count(DISTINCT event_object_table)::text FROM information_schema.triggers
           WHERE trigger_name='trg_stamp_branch')
  UNION ALL
  SELECT 22, 'Audit trigger', '12',
         (SELECT count(DISTINCT event_object_table)::text FROM information_schema.triggers
           WHERE trigger_name='trg_biz_audit')

  -- ── Audit trail ─────────────────────────────────────────────────────────────
  UNION ALL
  SELECT 23, 'biz_audit_trail exists', 'yes',
         CASE WHEN to_regclass('public.biz_audit_trail') IS NOT NULL THEN 'yes' ELSE 'MISSING' END
  UNION ALL
  SELECT 24, 'Audit trail is append only', 'no update/delete policy',
         (SELECT CASE WHEN count(*)=0 THEN 'no update/delete policy'
                      ELSE 'EDITABLE, '||count(*)||' policy' END
            FROM pg_policies WHERE schemaname='public' AND tablename='biz_audit_trail'
             AND cmd IN ('UPDATE','DELETE'))
  UNION ALL
  SELECT 25, 'Audit trail readable by owner only', 'yes',
         (SELECT CASE WHEN count(*)=1 THEN 'yes' ELSE 'CHECK' END FROM pg_policies
           WHERE schemaname='public' AND tablename='biz_audit_trail' AND cmd='SELECT')
  UNION ALL
  -- The bug this migration fixed: staff writes used to be silently dropped here.
  SELECT 26, 'Staff can write the activity log', 'yes',
         (SELECT CASE WHEN count(*)=1 THEN 'yes' ELSE 'STILL BROKEN' END FROM pg_policies
           WHERE schemaname='public' AND tablename='biz_activity_log' AND cmd='INSERT'
             AND with_check ILIKE '%is_biz_staff%')

  -- ── RLS actually switched on ────────────────────────────────────────────────
  UNION ALL
  SELECT 27, 'RLS enabled on new tables', '3',
         (SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relrowsecurity
             AND c.relname IN ('biz_branches','biz_branch_pincodes','biz_audit_trail'))

  -- ── Data safety ─────────────────────────────────────────────────────────────
  UNION ALL
  SELECT 28, 'Sales rows with no branch', '0',
         (SELECT count(*)::text FROM biz_sales WHERE branch_id IS NULL)
  UNION ALL
  SELECT 29, 'Orders with no branch', '0',
         (SELECT count(*)::text FROM orders WHERE branch_id IS NULL)
  UNION ALL
  SELECT 30, 'Staff accounts with no branch', '0',
         (SELECT count(*)::text FROM profiles WHERE role='staff' AND branch_id IS NULL)

  -- ── Bookkeeping ─────────────────────────────────────────────────────────────
  UNION ALL
  SELECT 31, 'Migration registered', 'yes',
         (SELECT CASE WHEN count(*)=1 THEN 'yes' ELSE 'not registered' END
            FROM schema_migrations WHERE filename='20260830_branches.sql')
)
SELECT
  CASE WHEN actual IS NOT DISTINCT FROM expected THEN 'PASS' ELSE 'FAIL' END AS status,
  check_name,
  expected,
  actual
FROM checks
ORDER BY (CASE WHEN actual IS NOT DISTINCT FROM expected THEN 1 ELSE 0 END), sort_key;


-- ════════════════════════════════════════════════════════════════════════════════
-- QUERY 2: row counts per table per branch
--
-- This is the one worth keeping as a CSV. Run it now, and again after Gurugram has
-- been working for a while. total_rows must never drop, and null_branch must stay 0.
--
-- query_to_xml is how one query can count across many tables without writing the
-- table list out by hand, so a table added later is picked up automatically.
-- ════════════════════════════════════════════════════════════════════════════════
SELECT
  c.table_name,
  (xpath('/row/c/text()', query_to_xml(
     format('SELECT count(*) AS c FROM public.%I', c.table_name),
     false, true, '')))[1]::text::bigint AS total_rows,
  (xpath('/row/c/text()', query_to_xml(
     format('SELECT count(*) AS c FROM public.%I WHERE branch_id = ''noida''', c.table_name),
     false, true, '')))[1]::text::bigint AS noida,
  (xpath('/row/c/text()', query_to_xml(
     format('SELECT count(*) AS c FROM public.%I WHERE branch_id = ''gurugram''', c.table_name),
     false, true, '')))[1]::text::bigint AS gurugram,
  (xpath('/row/c/text()', query_to_xml(
     format('SELECT count(*) AS c FROM public.%I WHERE branch_id IS NULL', c.table_name),
     false, true, '')))[1]::text::bigint AS no_branch
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.column_name  = 'branch_id'
  AND c.table_name  <> 'profiles'
ORDER BY 1;
