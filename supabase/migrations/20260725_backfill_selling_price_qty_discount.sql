-- One-time backfill: correct selling_price/cogs on manually-entered orders saved
-- before the qty/discount fix (commit 7589f758, 2026-07-24 20:29 IST).
--
-- Before that fix, admin-biz.html's buildSaleRowsWithIds() saved:
--   selling_price = rate × (1 + gst%)      ← per ONE unit, qty dropped entirely,
--                                             discount never subtracted
--   cogs          = per-unit cost           ← same qty-dropping bug
-- even though biz_sales.selling_price is documented ("what customer paid incl. GST")
-- and every report in the app (Dashboard, Sales, GST filing, Balance Sheet) sums it
-- as a line TOTAL, not multiplied by qty again. Any manually-entered order with
-- qty > 1 or a discount has therefore been under-reporting revenue/cost ever since
-- it was saved.
--
-- Scope, deliberately narrow:
--   - import_source = 'manual' only. Amazon/Flipkart CSV imports and the website-sync
--     path already compute selling_price as a full qty-multiplied total on their own
--     (see admin-biz.html's import handlers), they were never subject to this bug —
--     running this correction on them would wrongly multiply an already-correct total
--     by qty a second time.
--   - created_at before the fix landed (with a few minutes' buffer for deploy lag).
--     Rows saved at/after that point already have the correct total; touching them
--     again would double-count qty.
--   - qty > 1 OR discount_amount > 0 only. Rows with qty = 1 and no discount are a
--     no-op under the corrected formula (old and new formulas agree), left alone to
--     keep the blast radius to only the rows that actually need it.
--
-- Run the two SELECTs first to eyeball how many rows and what the numbers look like
-- before committing to the UPDATEs. Not idempotent in the usual sense (re-running
-- after the first UPDATE would double-correct), so run this exactly once.
-- ════════════════════════════════════════════════════════════════════════════════

-- ── PREVIEW (run first, review before running the UPDATEs below) ─────────────────
-- SELECT id, order_id, order_date, qty, discount_amount, gst_rate,
--        selling_price AS old_selling_price,
--        ROUND((qty * selling_price - discount_amount * (1 + gst_rate/100))::numeric, 2) AS new_selling_price,
--        cogs AS old_cogs, ROUND((qty * cogs)::numeric, 2) AS new_cogs
-- FROM biz_sales
-- WHERE import_source = 'manual'
--   AND created_at < '2026-07-24 20:35:00+05:30'
--   AND (qty > 1 OR COALESCE(discount_amount,0) > 0)
-- ORDER BY order_date DESC;

UPDATE biz_sales
SET selling_price = ROUND((qty * selling_price - COALESCE(discount_amount,0) * (1 + gst_rate/100))::numeric, 2)
WHERE import_source = 'manual'
  AND created_at < '2026-07-24 20:35:00+05:30'
  AND (qty > 1 OR COALESCE(discount_amount,0) > 0);

UPDATE biz_sales
SET cogs = ROUND((qty * cogs)::numeric, 2)
WHERE import_source = 'manual'
  AND created_at < '2026-07-24 20:35:00+05:30'
  AND qty > 1;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- Should return 0 rows once corrected (no manual pre-cutoff row should still look
-- like a bare per-unit price once qty/discount are accounted for):
-- SELECT id, order_id, qty, discount_amount, selling_price, cogs FROM biz_sales
-- WHERE import_source='manual' AND created_at < '2026-07-24 20:35:00+05:30'
--   AND (qty > 1 OR COALESCE(discount_amount,0) > 0)
-- ORDER BY order_date DESC LIMIT 50;
-- ════════════════════════════════════════════════════════════════════════════════
