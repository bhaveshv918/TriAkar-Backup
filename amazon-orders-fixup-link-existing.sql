-- Fix-up for the 21 Amazon orders that were already sitting in biz_sales, imported earlier via
-- the shipping-label parser (import_source='label'). Those rows had sku/product_id = NULL, cogs
-- defaulted to a wrong ₹200 placeholder, and platform_fee defaulted to ₹0.00 — which is why
-- amazon-orders-2026-05-16-to-06-07-import.sql's INSERT silently did nothing (its
-- WHERE NOT EXISTS guard matches on order_id alone, so it correctly refused to create duplicates).
--
-- This script only UPDATEs the broken/missing fields:
--   - sku + product_id: link to the CS-BELD-6UKD product row
--   - cogs: correct 200.00 -> 160.00 (160gm WOL3D black filament, per actual cost basis)
--   - platform_fee: correct 0.00 -> 87.15 (Amazon's own average referral fee for this window)
--   - customer_city / customer_pincode / order_time: only fills in if currently NULL (COALESCE),
--     never overwrites existing values
-- shipping_fee, status, customer_name, customer_state, order_date are left untouched — they were
-- already correct.
--
-- Safe to re-run.

WITH fixdata(order_id, customer_city, customer_pincode, order_time) AS (
  VALUES
    ('403-4752809-7984334', 'Pune',           '411006', '02:03 PM'),
    ('405-5991727-0008362', 'Bengaluru',      '560062', '08:47 AM'),
    ('406-9805142-1098703', 'Pune',           '411021', '09:25 PM'),
    ('406-5443175-5653945', 'Bengaluru',      '560049', '02:40 AM'),
    ('403-9645902-1522761', 'Chennai',        '600074', '01:22 PM'),
    ('402-1962179-6689120', 'Mumbai',         '400034', '09:38 AM'),
    ('407-0111393-8366724', 'Cuttack',        '753001', '08:52 PM'),
    ('171-4168885-4737928', 'Greater Noida',  '201310', '06:02 PM'),
    ('171-1856049-3886760', 'North Goa',      '403508', '09:42 AM'),
    ('406-2616992-6163558', 'Pune',           '411020', '03:11 AM'),
    ('406-2737441-1611538', 'Vadodara',       '390012', '01:04 PM'),
    ('408-0356054-2945162', 'Hyderabad',      '500032', '01:26 PM'),
    ('404-5988406-6798753', 'Dimapur',        '797112', '07:59 AM'),
    ('406-6278544-1921945', 'Hyderabad',      '500075', '04:46 PM'),
    ('171-0774666-8349135', 'Panihati',       '700049', '01:00 PM'),
    ('408-1222195-9104356', 'Nashik',         '422006', '12:19 PM'),
    ('404-3406099-5209920', 'New Delhi',      '110048', '02:31 AM'),
    ('403-1993446-9297901', 'Chennai',        '600095', '10:33 AM'),
    ('406-0882719-5525938', 'Hyderabad',      '500034', '11:54 PM'),
    ('406-4240103-7857908', 'New Delhi',      '110080', '01:03 PM'),
    ('408-8316311-5881934', 'New Delhi',      '110019', '01:58 AM')
)
UPDATE biz_sales s
SET
  sku          = 'CS-BELD-6UKD',
  product_id   = (SELECT id FROM biz_products WHERE sku = 'CS-BELD-6UKD'),
  cogs         = 160.00,
  platform_fee = 87.15,
  gst_rate     = 18.00,
  customer_city    = COALESCE(s.customer_city, f.customer_city),
  customer_pincode = COALESCE(s.customer_pincode, f.customer_pincode),
  order_time        = COALESCE(s.order_time, f.order_time)
FROM fixdata f
WHERE s.order_id = f.order_id;

-- ── Now insert the 8 returns (previously 0-rowed because the join required sku
--    which was NULL on every row until the UPDATE above ran) ───────────────
WITH returns(order_id, date, amount_lost, refund_given, notes) AS (
  VALUES
    ('407-0111393-8366724', DATE '2026-06-11', 999.00, 999.00,  'Credit note CN-8. Item returned broken/damaged, no resale value, full write-off.'),
    ('406-2616992-6163558', DATE '2026-06-05', 999.00, 1004.00, 'Credit note CN-4. Item returned broken/damaged, no resale value, full write-off.'),
    ('406-2737441-1611538', DATE '2026-06-09', 999.00, 999.00,  'Credit note CN-7. Item returned broken/damaged, no resale value, full write-off.'),
    ('408-0356054-2945162', DATE '2026-06-07', 999.00, 999.00,  'Credit note CN-6. Item returned broken/damaged, no resale value, full write-off.'),
    ('408-1222195-9104356', DATE '2026-06-06', 999.00, 1013.00, 'Credit note CN-5. Item returned broken/damaged, no resale value, full write-off.'),
    ('403-1993446-9297901', DATE '2026-06-05', 999.00, 1013.00, 'Credit note CN-3. Item returned broken/damaged, no resale value, full write-off.'),
    ('406-0882719-5525938', DATE '2026-06-03', 999.00, 1004.00, 'Credit note CN-2. Item returned broken/damaged, no resale value, full write-off.'),
    ('408-8316311-5881934', DATE '2026-05-20', 999.00, 999.00,  'Refund confirmed by Amazon; exact refund date/CN not found in available source reports (estimated). Item returned broken/damaged, no resale value, full write-off.')
)
INSERT INTO biz_returns (sale_id, channel_id, order_id, type, date, amount_lost, refund_given, status, reason, notes)
SELECT s.id, 'amazon', r.order_id, 'return', r.date, r.amount_lost, r.refund_given, 'lost', 'Returned broken - total loss', r.notes
FROM returns r
JOIN biz_sales s ON s.order_id = r.order_id AND s.sku = 'CS-BELD-6UKD'
WHERE NOT EXISTS (SELECT 1 FROM biz_returns br WHERE br.order_id = r.order_id);

-- ── Stock movements (all 21, guarded by reference_id so this never double-inserts) ──
INSERT INTO biz_stock_movements (product_id, movement_type, qty, unit_cost, reference_id, notes, date)
SELECT s.product_id, 'sale', -1, 160.00, s.order_id,
       CASE WHEN s.status = 'returned'
            THEN 'Sold then returned broken; not restocked, treated as write-off'
            ELSE 'Amazon sale' END,
       s.order_date
FROM biz_sales s
WHERE s.sku = 'CS-BELD-6UKD'
  AND NOT EXISTS (SELECT 1 FROM biz_stock_movements m WHERE m.reference_id = s.order_id AND m.movement_type = 'sale');

-- ── is_deleted fix ───────────────────────────────────────────────────────
-- These 21 rows were sitting with is_deleted = true from the earlier label import, which is
-- why admin-biz.html's "All Sales" tab (WHERE is_deleted = false) never rendered them even
-- though the rows existed in the table. This is the actual fix for that symptom.
UPDATE biz_sales SET is_deleted = false WHERE sku = 'CS-BELD-6UKD';

-- ── Sanity check ─────────────────────────────────────────────────────────
-- SELECT count(*), sum(selling_price) FROM biz_sales WHERE sku='CS-BELD-6UKD'; -- expect 21 / ₹20,979.00
-- SELECT count(*) FROM biz_returns WHERE order_id LIKE '%'; -- expect 8 new rows for these orders
