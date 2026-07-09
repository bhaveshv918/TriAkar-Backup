-- TriAkar — one-time backfill: attach customer_id to historical biz_sales rows.
--
-- Round 3 added biz_sales.customer_id (see 20260709_biz_sales_customer_id.sql) and wired
-- new sales going forward (insertSalesResilient / resolveCustomerId in admin-biz.html) to
-- set it automatically. This script catches up every OLD row that predates that change.
--
-- Matching is EXACT only, deliberately: normalized phone (last 10 digits) first, then an
-- exact case-insensitive name match. No fuzzy/similarity matching is used — that was ruled
-- out as unsafe to run unattended on old free-text data. If a sale has neither a phone nor
-- a name match against any existing biz_customers row, a new one is created for it.
--
-- Safe to run more than once — every step only touches rows where customer_id IS NULL, so
-- re-running after a partial run (or after new historical data appears) is a no-op for
-- rows already backfilled.
--
-- Run this AFTER 20260709_biz_sales_customer_id.sql. Run in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════════

-- Step 1 — create a biz_customers row for every distinct (name, phone) combo among
-- unlinked sales that doesn't already match an existing customer record.
WITH missing AS (
  SELECT trim(s.customer_name) AS name,
         NULLIF(right(regexp_replace(coalesce(s.customer_phone, ''), '\D', '', 'g'), 10), '') AS phone
  FROM biz_sales s
  WHERE s.customer_id IS NULL
    AND s.customer_name IS NOT NULL
    AND trim(s.customer_name) <> ''
  GROUP BY 1, 2
)
INSERT INTO biz_customers (name, phone)
SELECT m.name, m.phone
FROM missing m
WHERE NOT EXISTS (
  SELECT 1 FROM biz_customers c
  WHERE (m.phone IS NOT NULL AND right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10) = m.phone)
     OR lower(trim(c.name)) = lower(m.name)
);

-- Step 2 — link by exact normalized phone match (most reliable signal).
UPDATE biz_sales s
SET customer_id = c.id
FROM biz_customers c
WHERE s.customer_id IS NULL
  AND s.customer_name IS NOT NULL
  AND right(regexp_replace(coalesce(s.customer_phone, ''), '\D', '', 'g'), 10) <> ''
  AND right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10)
    = right(regexp_replace(coalesce(s.customer_phone, ''), '\D', '', 'g'), 10);

-- Step 3 — link whatever's left by exact case-insensitive name match.
UPDATE biz_sales s
SET customer_id = c.id
FROM biz_customers c
WHERE s.customer_id IS NULL
  AND s.customer_name IS NOT NULL
  AND lower(trim(c.name)) = lower(trim(s.customer_name));

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- Should return 0 (or only rows with a genuinely blank customer_name):
--   SELECT count(*) FROM biz_sales WHERE customer_id IS NULL AND customer_name IS NOT NULL AND trim(customer_name) <> '';
-- Sanity spot-check a few:
--   SELECT s.order_id, s.customer_name, s.customer_phone, c.name, c.phone
--   FROM biz_sales s JOIN biz_customers c ON c.id = s.customer_id
--   ORDER BY s.order_date DESC LIMIT 20;
-- ════════════════════════════════════════════════════════════════════════════════
