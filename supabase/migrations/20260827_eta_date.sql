-- TriAkar : the delivery date the customer was actually promised
--
-- dispatch_date answers "when did it leave", which is a fact about the studio. It is not
-- what support gets asked, and it is not what the customer wrote down. "Expect it Friday"
-- is a separate promise and needs its own field, or it lives in someone's head and the
-- answer changes depending on who is asked.
--
-- Set on the Add Order / Quotation form (Delivery / Pickup), and on a website order from
-- the Website Orders page, where it also drives the "arriving by" line on tracking.
--
-- Idempotent, safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════

-- Business OS orders (one row per line item, so the date repeats across an order's lines,
-- same as dispatch_date already does).
ALTER TABLE public.biz_sales
  ADD COLUMN IF NOT EXISTS eta_date DATE;

-- Website orders.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS eta_date DATE;

-- Finding what is overdue is the whole point of storing it, so it gets an index rather
-- than a full scan every time the queue is opened.
CREATE INDEX IF NOT EXISTS orders_eta_idx ON public.orders (eta_date)
  WHERE eta_date IS NOT NULL;

COMMENT ON COLUMN public.biz_sales.eta_date IS
  'Delivery date promised to the customer. Distinct from dispatch_date, which is when it left.';
COMMENT ON COLUMN public.orders.eta_date IS
  'Delivery date promised to the customer, shown on track-order.html.';

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
--   SELECT order_id, dispatch_date, eta_date FROM biz_sales
--    WHERE eta_date IS NOT NULL ORDER BY eta_date LIMIT 10;
--   SELECT count(*) FROM orders WHERE eta_date < current_date
--     AND order_status NOT IN ('delivered','cancelled','returned','refunded');
--   The second one is your overdue list.
-- ════════════════════════════════════════════════════════════════════════════════
