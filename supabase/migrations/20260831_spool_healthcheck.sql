WITH checks(k, check_name, expected, actual) AS (
  SELECT 1, 'Transfer ledger table exists', 'yes',
         CASE WHEN to_regclass('public.biz_spool_transfers') IS NOT NULL THEN 'yes' ELSE 'MISSING' END
  UNION ALL
  SELECT 2, 'is_personal_use column on biz_sales', 'yes',
         (SELECT CASE WHEN count(*)=1 THEN 'yes' ELSE 'MISSING' END FROM information_schema.columns
           WHERE table_schema='public' AND table_name='biz_sales' AND column_name='is_personal_use')
  UNION ALL
  SELECT 3, 'is_personal_use defaults to false', 'false',
         (SELECT COALESCE(column_default,'none') FROM information_schema.columns
           WHERE table_schema='public' AND table_name='biz_sales' AND column_name='is_personal_use')
  UNION ALL
  SELECT 4, 'Owner can manage transfers', 'yes',
         (SELECT CASE WHEN count(*)=1 THEN 'yes' ELSE 'MISSING' END FROM pg_policies
           WHERE tablename='biz_spool_transfers' AND policyname='biz_spool_transfers_owner')
  UNION ALL
  SELECT 5, 'Staff can only read transfers', 'SELECT',
         (SELECT COALESCE(max(cmd),'MISSING') FROM pg_policies
           WHERE tablename='biz_spool_transfers' AND policyname='biz_spool_transfers_staff_read')
  UNION ALL
  SELECT 6, 'Staff cannot write transfers', 'none',
         COALESCE((SELECT string_agg(cmd,', ') FROM pg_policies
           WHERE tablename='biz_spool_transfers' AND cmd IN ('INSERT','UPDATE','DELETE')
             AND policyname <> 'biz_spool_transfers_owner'),'none')
  UNION ALL
  SELECT 7, 'RLS switched on', 'yes',
         (SELECT CASE WHEN bool_and(relrowsecurity) THEN 'yes' ELSE 'OFF' END
            FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relname='biz_spool_transfers')
  UNION ALL
  SELECT 8, 'Transfer indexes', '3',
         (SELECT count(*)::text FROM pg_indexes
           WHERE schemaname='public' AND tablename='biz_spool_transfers' AND indexname LIKE 'biz_spool_transfers_%' AND indexname NOT LIKE '%_pkey')
  UNION ALL
  SELECT 9, 'Migration registered', 'yes',
         (SELECT CASE WHEN count(*)=1 THEN 'yes' ELSE 'not registered' END FROM schema_migrations
           WHERE filename='20260831_spool_transfers_personal_use.sql')
  UNION ALL
  SELECT 10,'Existing sales untouched by the new flag', '0',
         (SELECT count(*)::text FROM biz_sales WHERE is_personal_use)
)
SELECT CASE WHEN actual IS NOT DISTINCT FROM expected THEN 'PASS' ELSE 'FAIL' END AS status,
       check_name, expected, actual
FROM checks
ORDER BY (CASE WHEN actual IS NOT DISTINCT FROM expected THEN 1 ELSE 0 END), k;
