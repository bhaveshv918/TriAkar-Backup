-- TriAkar — Round 3 Batch 2: extend biz_sales lifecycle status
--
-- Adds the new mid/post-dispatch stages requested: 'delaying' (still in production but
-- running behind), 'return_initiated' / 'return_picked_up' (return in progress, still
-- tracked in Open Orders until physically back), 'claim_filed' (a terminal Open-Orders
-- state once a return has moved into claim handling), and splits the old generic
-- 'cancelled' into 'cancelled_before_dispatch' / 'cancelled_before_delivery' (the original
-- 'cancelled' value is kept for backward compatibility with existing rows/exports).
--
-- Idempotent — safe to run multiple times. Existing rows are not touched.
-- ════════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.biz_sales'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%IN%'
  LOOP
    EXECUTE 'ALTER TABLE public.biz_sales DROP CONSTRAINT ' || quote_ident(c.conname);
  END LOOP;
END $$;

ALTER TABLE public.biz_sales ADD CONSTRAINT biz_sales_status_check
  CHECK (status IN (
    'pending','order_received','processing','printing','packed',
    'dispatched','delivered','delaying',
    'return_initiated','return_picked_up','returned','claim_filed',
    'completed','delayed',
    'cancelled_before_dispatch','cancelled_before_delivery','cancelled',
    'claimed'
  ));

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid='public.biz_sales'::regclass AND contype='c' AND conname='biz_sales_status_check';
-- ════════════════════════════════════════════════════════════════════════════════
