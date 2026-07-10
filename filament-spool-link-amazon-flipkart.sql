-- Links every unlinked Amazon + Flipkart order (all Batman figurine variants, all black PLA)
-- to an existing filament_inventory spool for cost/history traceability.
--
-- Context: biz_sales.spool_id / grams_used were NULL on all these rows even though the
-- physical filament was genuinely consumed making them. The 18 WOL3D black-PLA spools in
-- filament_inventory are already marked 'Finsh' (fully used, 18,000g total) — that consumption
-- already happened and already includes these very orders. So this script does NOT create new
-- spool rows or add more grams_used to filament_inventory (that would double-count); it only
-- round-robins the existing 18 spool IDs across the sales rows so each order points at a real
-- spool, and records grams_used = qty * 160 on the sale itself for reporting.
--
-- Safe to re-run (only targets rows where spool_id IS NULL, so already-linked rows are skipped).

WITH spools AS (
  SELECT array_agg(id ORDER BY id) AS ids
  FROM filament_inventory
  WHERE filament_type = 'PLA' AND color ILIKE '%black%'
),
targets AS (
  SELECT id, qty, ROW_NUMBER() OVER (ORDER BY order_date, id) AS rn
  FROM biz_sales
  WHERE channel_id IN ('amazon','flipkart')
    AND is_deleted = false
    AND spool_id IS NULL
)
UPDATE biz_sales s
SET spool_id   = (SELECT ids[((t.rn - 1) % array_length(ids,1)) + 1] FROM spools),
    grams_used = COALESCE(t.qty,1) * 160
FROM targets t
WHERE s.id = t.id;

-- ── Sanity check ─────────────────────────────────────────────────────────
-- SELECT channel_id, count(*), sum(grams_used) FROM biz_sales
-- WHERE channel_id IN ('amazon','flipkart') AND is_deleted=false
-- GROUP BY channel_id;
-- Expect: amazon 21 rows / 3,360g, flipkart 65 rows / ~10,560g+ (accounts for any qty>1 line items)
