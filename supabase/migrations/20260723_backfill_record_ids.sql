-- TriAkar Business OS: backfill Universal Record ID onto every existing row
-- that predates it (was intentionally left null before, per the user's direct
-- follow-up ask this is now backfilled instead).
--
-- Orders (biz_sales) are grouped by order_id first: one order can be several
-- biz_sales rows (one per line item) sharing a single order_id, and they must
-- all get the SAME record_id, not one each, matching how a fresh order already
-- gets exactly one record_id shared across all its line items.
--
-- Safe, additive, idempotent (only ever touches rows where record_id IS NULL,
-- safe to run more than once, a second run is a no-op).
-- ════════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  v_rid TEXT;
BEGIN
  -- Orders: one gen_record_id() call per distinct order_id, applied to every
  -- line-item row sharing it. Rows with a null/blank order_id (legacy single
  -- manual entries) get their own individual record_id instead, keyed on the
  -- row's own id so there's no risk of accidentally grouping unrelated rows.
  FOR r IN
    SELECT DISTINCT order_id FROM biz_sales
    WHERE record_id IS NULL AND order_id IS NOT NULL AND order_id <> ''
  LOOP
    v_rid := gen_record_id('order', r.order_id);
    UPDATE biz_sales SET record_id = v_rid WHERE order_id = r.order_id AND record_id IS NULL;
  END LOOP;

  FOR r IN SELECT id FROM biz_sales WHERE record_id IS NULL AND (order_id IS NULL OR order_id = '')
  LOOP
    v_rid := gen_record_id('order', r.id::text);
    UPDATE biz_sales SET record_id = v_rid WHERE id = r.id;
  END LOOP;

  -- Quotations
  FOR r IN SELECT id, quotation_number FROM biz_quotations WHERE record_id IS NULL
  LOOP
    v_rid := gen_record_id('quotation', COALESCE(r.quotation_number, r.id::text));
    UPDATE biz_quotations SET record_id = v_rid WHERE id = r.id;
  END LOOP;

  -- Expenses, Purchases, Returns, Customers (recommendation #5's extended scope).
  -- Guarded by an actual column check, not just table existence, so this migration
  -- is safe to run in either order relative to
  -- 20260723_record_id_extension_and_hardening.sql (the one that adds these
  -- columns), if that one hasn't run yet, these four are simply skipped for now
  -- and pick up on a later re-run, this DO block is idempotent throughout.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='biz_expenses' AND column_name='record_id') THEN
    FOR r IN SELECT id, vendor FROM biz_expenses WHERE record_id IS NULL
    LOOP
      v_rid := gen_record_id('expense', COALESCE(r.vendor, r.id::text));
      UPDATE biz_expenses SET record_id = v_rid WHERE id = r.id;
    END LOOP;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='biz_purchases' AND column_name='record_id') THEN
    FOR r IN SELECT id, item FROM biz_purchases WHERE record_id IS NULL
    LOOP
      v_rid := gen_record_id('purchase', COALESCE(r.item, r.id::text));
      UPDATE biz_purchases SET record_id = v_rid WHERE id = r.id;
    END LOOP;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='biz_returns' AND column_name='record_id') THEN
    FOR r IN SELECT id, order_id FROM biz_returns WHERE record_id IS NULL
    LOOP
      v_rid := gen_record_id('return', COALESCE(r.order_id, r.id::text));
      UPDATE biz_returns SET record_id = v_rid WHERE id = r.id;
    END LOOP;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='biz_customers' AND column_name='record_id') THEN
    FOR r IN SELECT id, name FROM biz_customers WHERE record_id IS NULL
    LOOP
      v_rid := gen_record_id('customer', COALESCE(r.name, r.id::text));
      UPDATE biz_customers SET record_id = v_rid WHERE id = r.id;
    END LOOP;
  END IF;
END $$;

-- Self-register, guarded the same way, in case schema_migrations hasn't been
-- created yet (it comes from 20260723_record_id_extension_and_hardening.sql).
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    INSERT INTO schema_migrations (filename) VALUES ('20260723_backfill_record_ids.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END $$;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT count(*) FILTER (WHERE record_id IS NULL) AS still_null, count(*) AS total FROM biz_sales;
-- SELECT count(*) FILTER (WHERE record_id IS NULL) AS still_null, count(*) AS total FROM biz_quotations;
-- SELECT order_id, count(DISTINCT record_id) AS distinct_ids FROM biz_sales
--   WHERE order_id IS NOT NULL GROUP BY order_id HAVING count(DISTINCT record_id) > 1;
--   (should return zero rows, every line item of one order must share one record_id)
-- ════════════════════════════════════════════════════════════════════════════════
