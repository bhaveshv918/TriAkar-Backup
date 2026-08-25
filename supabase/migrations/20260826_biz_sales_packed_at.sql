-- TriAkar : SLA clock stops at Packed, not at Completed
--
-- PROBLEM: the SLA Breached KPI on admin-biz.html counted any still-open order whose
-- promised delivery_date had passed, regardless of how far along it actually was. In the
-- studio's real workflow the order is packed and the customer is told "ready", and the
-- customer then takes however long they take to collect it. That collection lag was being
-- counted as a TriAkar SLA breach, which it isn't. The promise being measured is
-- "ready by this date", so the clock has to stop the moment the order is packed.
--
-- Nothing recorded WHEN an order was packed, only its current status, so "packed on time"
-- could not be distinguished from "packed three weeks late". This adds that stamp.
--
-- Idempotent, safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. The date the order first reached packed-or-beyond. Set once, never overwritten
--    (the first time it was ready is the number SLA is judged on). DATE, matching
--    delivered_at, since only the calendar day matters for the promise comparison.
ALTER TABLE public.biz_sales ADD COLUMN IF NOT EXISTS packed_at DATE;

-- 2. Backfill for orders that were already packed-or-beyond before this column existed.
--    dispatch_date is the only real signal available: an order cannot be dispatched
--    before it was packed, so dispatch_date is the LATEST possible packed date. That
--    makes this a deliberately strict estimate (it can call an order late that was in
--    fact packed on time, never the reverse). Orders with no dispatch_date stay NULL and
--    are treated as "packed date unknown", excluded from SLA counting rather than guessed.
UPDATE public.biz_sales
   SET packed_at = dispatch_date
 WHERE packed_at IS NULL
   AND dispatch_date IS NOT NULL
   AND status IN ('packed','dispatched','delivered','return_initiated','return_picked_up',
                  'returned','claim_filed','completed','claimed');

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- How many packed-or-beyond orders still have no packed date (expected: those never dispatched):
--   SELECT status, count(*) FILTER (WHERE packed_at IS NULL) AS unknown, count(*) AS total
--     FROM biz_sales
--    WHERE is_deleted = false
--      AND status IN ('packed','dispatched','delivered','completed')
--    GROUP BY status;
-- Orders that were packed after their promised date (the real historical breaches):
--   SELECT order_id, delivery_date, packed_at, packed_at - delivery_date AS days_late
--     FROM biz_sales
--    WHERE is_deleted = false AND delivery_date IS NOT NULL AND packed_at > delivery_date
--    ORDER BY days_late DESC;
-- ════════════════════════════════════════════════════════════════════════════════
