-- TriAkar : record the wall (perimeter) count chosen on an Instant Quote
--
-- Walls are now a customer-selectable Advanced Setting on instant-quote.html. The pricing
-- model already assumed 2 walls (the shell allowance in instantQuotePricingService.js was
-- calibrated against a 2-wall Bambu Studio slice), so 2 stays the default and the price is
-- unchanged for anyone who leaves it alone. Storing the value matters because the studio
-- reviews every Instant Quote model by hand before printing, and wall count is one of the
-- things that review has to honour.
--
-- Idempotent, safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.instant_quote_requests
  ADD COLUMN IF NOT EXISTS wall_count SMALLINT NOT NULL DEFAULT 2;

-- Keep the column inside the range the UI and the API both enforce, so a bad direct write
-- cannot produce a quote that could never have been made through the site.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.instant_quote_requests'::regclass
       AND conname  = 'instant_quote_requests_wall_count_check'
  ) THEN
    ALTER TABLE public.instant_quote_requests
      ADD CONSTRAINT instant_quote_requests_wall_count_check
      CHECK (wall_count BETWEEN 1 AND 8);
  END IF;
END $$;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- Existing rows all backfill to the 2 the pricing model already assumed:
--   SELECT wall_count, count(*) FROM instant_quote_requests GROUP BY wall_count;
-- ════════════════════════════════════════════════════════════════════════════════
