-- TriAkar — Round 3: unify biz_sales lifecycle status
--
-- PROBLEM: biz_sales.status only ever allowed ('completed','returned','cancelled','claimed')
-- — there was no "still open" value at all. Every insert path (CSV import, label import)
-- hardcoded status:'completed' at creation time, and a *separate* production_status column
-- (queued/printing/post_processing/qc/packed) tracked the manufacturing stage in parallel.
-- Open Orders (admin-biz.html loadOpenOrders) filtered for
-- .in('status',['pending','processing','dispatched','delivered']) — values that could
-- NEVER exist per the old CHECK constraint — so it was structurally incapable of showing
-- anything. This widens 'status' into the single unified lifecycle the UI already assumed
-- (sfStatus / es_status dropdowns already listed pending/processing/dispatched/delivered)
-- and adds the remaining stages so production_status can be retired in favour of one field.
--
-- Idempotent — safe to run multiple times. Existing rows are NOT touched (historical
-- 'completed' rows stay 'completed'); only new inserts + the CHECK/DEFAULT change.
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Widen the CHECK constraint to the full lifecycle.
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
    'dispatched','delivered','completed','delayed','cancelled','returned','claimed'
  ));

-- 2. New sales should start as 'order_received', not silently be born 'completed'.
ALTER TABLE public.biz_sales ALTER COLUMN status SET DEFAULT 'order_received';

-- 3. Track exactly when an order was actually marked Completed (for SLA reporting —
--    promised date vs. actual completion date, Round 3 §2.2).
ALTER TABLE public.biz_sales ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- INSERT INTO biz_sales(channel_id,product_name,qty,selling_price,status)
--   VALUES('shop','test',1,100,'order_received'); -- should succeed
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid='public.biz_sales'::regclass AND contype='c' AND conname='biz_sales_status_check';
-- ════════════════════════════════════════════════════════════════════════════════
