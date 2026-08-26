-- TriAkar : one status pipeline for website orders, admin to customer
--
-- What was wrong, all of it visible to the customer:
--
--  * The studio works in Printing / Packed / Dispatched / In Transit (SLA even stops at
--    Packed), but a website order could only ever be set to processing or shipped. The
--    customer was shown a label that was a guess at what was really happening.
--  * orders.status and orders.order_status are two columns holding the same fact, kept in
--    step only by one controller. Everything that reads them does `order_status || status`,
--    so any other writer silently splits the truth in two.
--  * No history. The customer saw which step, never when, and nobody could answer "when did
--    this go out" without digging through the activity log.
--  * hold_at existed but no customer-facing page read it, so a parked order kept showing
--    whatever status it was parked on.
--
-- This migration fixes the data side of all four. Application changes ride along with it.
--
-- Idempotent, safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════

-- ── 1. Status history ────────────────────────────────────────────────────────────
-- One row per transition, written by the backend on every status change. Also what
-- feeds the dated timeline on track-order.html, so the customer sees "Packed, 24 Aug"
-- rather than an undated dot.
CREATE TABLE IF NOT EXISTS public.order_status_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status TEXT,                                  -- NULL for the first event
  to_status   TEXT NOT NULL,
  note        TEXT,                                  -- shown to the customer when customer_visible
  changed_by  TEXT,                                  -- admin email, or 'system' for automatic moves
  -- Internal moves (a correction, a mis-click undone) stay out of the customer's timeline
  -- without being deleted, so the audit trail is still complete.
  customer_visible BOOLEAN NOT NULL DEFAULT true,
  notified_at TIMESTAMPTZ,                           -- set when the status email actually went out
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_status_events_order_idx
  ON public.order_status_events (order_id, created_at DESC);

ALTER TABLE public.order_status_events ENABLE ROW LEVEL SECURITY;

-- account.html reads Supabase directly under the signed-in user, so a customer needs to
-- see the events of their own orders and nothing else. track-order.html goes through the
-- backend instead (service role), which is not subject to this.
DROP POLICY IF EXISTS "order_events_own_read" ON public.order_status_events;
CREATE POLICY "order_events_own_read" ON public.order_status_events
  FOR SELECT TO authenticated
  USING (
    customer_visible = true
    AND EXISTS (SELECT 1 FROM public.orders o
                 WHERE o.id = order_status_events.order_id
                   AND o.user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "order_events_admin_read" ON public.order_status_events;
CREATE POLICY "order_events_admin_read" ON public.order_status_events
  FOR SELECT TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com' OR public.is_biz_staff());

-- No insert/update/delete policy on purpose: events are written only by the backend's
-- service-role key, so a client cannot forge or rewrite an order's history.

-- ── 2. When the status last moved ────────────────────────────────────────────────
-- Cheap to read for "sitting in Printing for 4 days" style queues, without aggregating
-- the events table on every list render.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;
UPDATE public.orders SET status_changed_at = COALESCE(updated_at, created_at)
 WHERE status_changed_at IS NULL;

-- ── 3. One vocabulary ────────────────────────────────────────────────────────────
-- The studio's real stages replace the three vague ones. Old values are mapped, not
-- dropped, and the pre-migration value is preserved as an event below, so nothing about
-- an existing order becomes unreadable.
--
--   placed     -> confirmed     (they always meant the same thing)
--   processing -> printing      (what "processing" actually was)
--   shipped    -> dispatched    (matches the Business OS wording)
--
-- Full list after this: whatsapp_pending, pending, confirmed, printing, quality_check,
-- packed, dispatched, in_transit, delivered, cancelled, returned, refunded.
-- On-hold is deliberately NOT a status: it is the hold_at flag alongside one, so an order
-- comes off hold to the stage it was already at rather than losing its place.

-- Keep the old value first, as the opening entry in each order's history.
INSERT INTO public.order_status_events (order_id, from_status, to_status, note, changed_by, customer_visible, created_at)
SELECT o.id, NULL, COALESCE(o.order_status, o.status, 'pending'),
       'Order placed', 'system', true, o.created_at
  FROM public.orders o
 WHERE NOT EXISTS (SELECT 1 FROM public.order_status_events e WHERE e.order_id = o.id);

UPDATE public.orders SET status = 'confirmed'   WHERE status = 'placed';
UPDATE public.orders SET status = 'printing'    WHERE status = 'processing';
UPDATE public.orders SET status = 'dispatched'  WHERE status = 'shipped';
UPDATE public.orders SET order_status = 'confirmed'  WHERE order_status = 'placed';
UPDATE public.orders SET order_status = 'printing'   WHERE order_status = 'processing';
UPDATE public.orders SET order_status = 'dispatched' WHERE order_status = 'shipped';

-- ── 4. The two columns can no longer drift ───────────────────────────────────────
-- Rather than dropping one (other writers, webhooks and old clients still set either),
-- a trigger makes them the same fact by construction. Whichever one a writer touches,
-- both end up correct, and status_changed_at is stamped for free.
CREATE OR REPLACE FUNCTION public.sync_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.order_status := COALESCE(NEW.order_status, NEW.status);
    NEW.status       := COALESCE(NEW.status, NEW.order_status);
    NEW.status_changed_at := COALESCE(NEW.status_changed_at, now());
    RETURN NEW;
  END IF;

  -- Update: whichever column actually changed wins, and is copied to the other.
  IF NEW.order_status IS DISTINCT FROM OLD.order_status THEN
    NEW.status := NEW.order_status;
    NEW.status_changed_at := now();
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.order_status := NEW.status;
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_sync_status ON public.orders;
CREATE TRIGGER orders_sync_status
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_status();

-- Bring any row that had already drifted back into line. order_status wins, it is the one
-- every reader checks first, so it is what customers have been seeing.
UPDATE public.orders SET status = order_status
 WHERE order_status IS NOT NULL AND status IS DISTINCT FROM order_status;

-- ── 5. Which stages email the customer ───────────────────────────────────────────
-- Read by the backend on every status change. The middle stages are off by default: a
-- customer does not want six emails about one order, they want to know it is confirmed,
-- it has gone out, and it has arrived. Editable from the admin panel.
INSERT INTO public.site_settings (key, value)
VALUES ('order_status_notify',
  '{"confirmed":true,"printing":false,"quality_check":false,"packed":false,"dispatched":true,"in_transit":false,"delivered":true,"cancelled":false,"returned":false,"refunded":false}')
ON CONFLICT (key) DO NOTHING;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
--   SELECT order_status, count(*) FROM orders GROUP BY 1 ORDER BY 2 DESC;
--     No 'placed', 'processing' or 'shipped' should remain.
--   SELECT count(*) FROM orders WHERE status IS DISTINCT FROM order_status;
--     Expect 0, now and permanently.
--   SELECT count(*) FROM order_status_events;
--     Expect one row per existing order, more as statuses start moving.
-- ════════════════════════════════════════════════════════════════════════════════
