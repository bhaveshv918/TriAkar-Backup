-- ============================================================================
-- Flipkart Seller Dashboard status update — from "Seller Dashboard.pdf"
-- (a print-to-PDF of the Orders view, NOT a clean CSV export — the SKU/
-- product-description column came out scrambled in the PDF text layer, but
-- Order ID, price, "Completed On" timestamp, Status, and the product's FSN
-- code (from the flipkart.com/product/p/itme?pid=... link) all extracted
-- cleanly and reliably.)
--
-- Run this once in the Supabase SQL editor, after
-- 2026-07_flipkart_historical_orders.sql.
--
-- ── PART 1 — status corrections on already-imported orders ────────────────
-- These 3 orders were recorded as 'returned' from the earlier Order-CSV
-- export, but this newer Dashboard snapshot (as of 4 July) shows them as
-- Delivered with no return in progress — confirmed by you to treat as
-- completed (return was requested/flagged earlier but the order actually
-- went through).
--
-- ── PART 2 — new orders, clearly identified ────────────────────────────────
-- 11 orders not in the earlier CSV (mostly Cancelled/Returned) whose FSN
-- code cleanly matched a known SKU in your catalog. Note: the Dashboard
-- view has NO customer name/address/city — these rows carry only order_id,
-- SKU, price, status, and date, suffient for revenue/return tracking but
-- not for customer follow-up. Cancelled orders show "NA" for price in the
-- source and are inserted with selling_price = 0 (matching how the app's
-- own CSV importer already treats "NA": parseFloat('NA')||0).
--
-- ── PART 3 — genuinely unclear, left for manual review ─────────────────────
-- Order OD337774552931770100 references FSN "SHIHMQKXVTN2EBGE", which does
-- not match any SKU seen in your historical data (possibly a new/different
-- size variant of the Decorative Showpiece — the garbled PDF text hints at
-- "24 cm" but it isn't reliably readable). Rather than guess, this is
-- inserted with status='pending' and a note in product_name so it surfaces
-- for you to fix manually (Business OS → All Sales → find this order →
-- edit SKU/product name once you've checked Flipkart Seller Hub directly).
--
-- Every insert is guarded by NOT EXISTS on (order_id, sku), safe to re-run.
-- ============================================================================

BEGIN;

-- ── PART 1: status corrections ─────────────────────────────────────────────
UPDATE biz_sales SET status = 'completed'
WHERE order_id IN ('OD437961063581670100','OD437693016411513100','OD337536770056639100')
  AND status <> 'completed';

-- ── PART 2: new orders, known SKU ──────────────────────────────────────────
INSERT INTO biz_sales (
  channel_id, order_id, order_date, hsn_code, status, sku,
  product_id, product_name, gst_rate, selling_price, qty,
  cogs, platform_fee, import_source
)
SELECT
  v.channel_id, v.order_id, v.order_date, v.hsn_code, v.status, v.sku,
  bp.id, v.product_name, v.gst_rate, v.selling_price, v.qty,
  COALESCE(bp.base_cost, 0), 0, 'flipkart_dashboard'
FROM (VALUES
  ('flipkart','OD437959880775564100','2026-06-29'::date,'3926','cancelled','TAF/FIG/BAT/BLK/047',
   'TRIAKAR Decorative Showpiece - 14 cm TAK-FG-BAT-BK-S1',18.00,0.00,1),

  ('flipkart','OD337927336735251100','2026-06-26'::date,'3926','cancelled','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1',18.00,0.00,1),

  ('flipkart','OD437838628180186100','2026-06-22'::date,'3926','returned','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2',18.00,909.00,1),

  ('flipkart','OD337798005438842100','2026-06-24'::date,'3926','returned','TAF/FIG/BAT/BLK/047',
   'TRIAKAR Decorative Showpiece - 14 cm TAK-FG-BAT-BK-S1',18.00,909.00,1),

  ('flipkart','OD337797622925975100','2026-06-18'::date,'3926','cancelled','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1',18.00,0.00,1),

  ('flipkart','OD437772070413654100','2026-06-24'::date,'3926','returned','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1',18.00,823.00,1),

  ('flipkart','OD437772070413654100','2026-06-24'::date,'3926','returned','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2',18.00,882.00,1),

  ('flipkart','OD337733700042254100','2026-06-24'::date,'3926','returned','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1',18.00,806.00,1),

  ('flipkart','OD437710439803558100','2026-06-18'::date,'3926','returned','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2',18.00,844.00,1),

  ('flipkart','OD437623272226686100','2026-05-26'::date,'3926','returned','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2',18.00,1184.00,1),

  ('flipkart','OD437516737779553100','2026-05-09'::date,'3926','cancelled','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1',18.00,0.00,1),

  ('flipkart','OD437512321272351100','2026-05-09'::date,'3926','returned','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1',18.00,873.00,1)

) AS v(channel_id, order_id, order_date, hsn_code, status, sku, product_name, gst_rate, selling_price, qty)
LEFT JOIN biz_products bp ON bp.sku = v.sku
WHERE NOT EXISTS (
  SELECT 1 FROM biz_sales s WHERE s.order_id = v.order_id AND s.sku = v.sku
);

-- ── PART 3: unclear — flagged pending for manual review ────────────────────
INSERT INTO biz_sales (
  channel_id, order_id, order_date, hsn_code, status, sku,
  product_name, gst_rate, selling_price, qty, cogs, platform_fee, import_source, notes
)
SELECT 'flipkart','OD337774552931770100','2026-06-24'::date,'3926','pending',NULL,
  'NEEDS REVIEW — unknown SKU (FSN SHIHMQKXVTN2EBGE, not in catalog). Source: Seller Dashboard PDF, showed "Returned" ₹883.',
  18.00,883.00,1,0,0,'flipkart_dashboard','Check Flipkart Seller Hub for this order''s actual product/SKU, then edit this row.'
WHERE NOT EXISTS (
  SELECT 1 FROM biz_sales s WHERE s.order_id = 'OD337774552931770100'
);

COMMIT;

-- ── VERIFY ───────────────────────────────────────────────────────────────
-- SELECT order_id, sku, product_name, selling_price, status, order_date
--   FROM biz_sales WHERE import_source='flipkart_dashboard'
--   ORDER BY order_date DESC;
-- SELECT * FROM biz_sales WHERE status='pending' AND import_source='flipkart_dashboard';
-- ============================================================================
