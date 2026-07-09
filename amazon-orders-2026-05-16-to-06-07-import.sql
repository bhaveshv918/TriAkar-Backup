-- Amazon.in order import: TRIAKAR Batman on Rubble Pedestal Collectible Figurine (SKU CS-BELD-6UKD)
-- Order window: 2026-05-16 through 2026-06-07 (order date), 21 total orders.
-- Sources reconciled: Amazon order confirmation letters (per-order buyer/city/refund detail),
-- Seller Central "Manage Orders" export (delivery/return status per order),
-- MTR_B2C / MTR_B2B GST reports (invoice numbers, credit notes, payment method, CGST/SGST vs IGST),
-- Business Report CSV (units-ordered-by-day, used to cross-check dates), Fee/P&L summary report
-- (confirms 21 total units, 8 refunded, 13 net; average referral fee 87.15/unit, average
-- shipping/postage fee 53.10/unit across all 21 charged units).
--
-- Order 405-0956209-5553145 appears ONLY as a "Cancel" transaction in MTR_B2C (never shipped) and
-- is NOT one of the 21 orders; it is correctly excluded here.
-- Several other order IDs show a "Cancel" row followed later by a "Shipment" row in MTR_B2C
-- (Amazon Easy Ship reschedule artifact, not a real cancellation) — those orders ARE included,
-- keyed off their real Shipment transaction.
--
-- Per user instruction: all 8 returns were physically damaged/broken on return, so they are
-- booked as a full write-off (COGS still charged, status='returned' so excluded from biz_pnl
-- revenue, and biz_returns.status='lost' since nothing is recoverable/resellable).
--
-- Safe to re-run: every INSERT is guarded with WHERE NOT EXISTS keyed on order_id / reference_id.

-- ── 1. Product ──────────────────────────────────────────────────────────
INSERT INTO biz_products (sku, name, category, product_type, base_cost, gst_rate, hsn_code, is_active, notes)
SELECT 'CS-BELD-6UKD',
       'TRIAKAR Batman on Rubble Pedestal Collectible Figurine, Matte Black, 140mm',
       '3D Printed Collectibles',
       'own',
       160.00,   -- 160gm black PLA filament (WOL3D) per unit @ ~₹1/gm
       18.00,
       '3926',
       true,
       'ASIN B0GYRZVF7G. Cost basis: 160gm WOL3D black filament, ~₹160 COGS per unit.'
WHERE NOT EXISTS (SELECT 1 FROM biz_products WHERE sku = 'CS-BELD-6UKD');

-- ── 2. Sales (all 21 orders) ────────────────────────────────────────────
-- selling_price = ₹999.00 GST-inclusive for every order (single unit @ ₹999).
-- platform_fee = ₹87.15 and shipping_fee = ₹53.10 per unit: these are the average
-- per-unit referral fee and per-unit postage/shipping fee taken from Amazon's own
-- fee/P&L summary report for this exact 21-unit window (no per-order fee breakdown
-- was available in the source reports, so the verified average is used for every line).
-- status='returned' rows are excluded from biz_pnl (which only sums status='completed').

WITH orders(order_id, order_date, order_time, customer_name, customer_city, customer_state, customer_pincode, status, payment_mode, notes) AS (
  VALUES
    ('403-4752809-7984334', DATE '2026-06-07', '02:03 PM', 'Ketan Dossa',            'Pune',           'Maharashtra',    '411006', 'completed', 'prepaid_paystation', 'Invoice IN-28'),
    ('405-5991727-0008362', DATE '2026-06-07', '08:47 AM', 'Sourav Gupta (Swati)',   'Bengaluru',      'Karnataka',      '560062', 'completed', 'prepaid_cc',         'Invoice IN-27'),
    ('406-9805142-1098703', DATE '2026-06-06', '09:25 PM', 'Footprints Consultancy', 'Pune',           'Maharashtra',    '411021', 'completed', 'prepaid_cc',         'B2B order. Invoice IN-26'),
    ('406-5443175-5653945', DATE '2026-06-06', '02:40 AM', 'Priyanka Rahut Mitra',   'Bengaluru',      'Karnataka',      '560049', 'completed', 'prepaid_paystation', 'Invoice IN-25'),
    ('403-9645902-1522761', DATE '2026-06-05', '01:22 PM', 'Ashok Kumar',            'Chennai',        'Tamil Nadu',     '600074', 'completed', 'cod',                'Invoice IN-24'),
    ('402-1962179-6689120', DATE '2026-06-05', '09:38 AM', 'Rumi',                   'Mumbai',         'Maharashtra',    '400034', 'completed', 'prepaid_paystation', 'Invoice IN-23'),
    ('407-0111393-8366724', DATE '2026-06-04', '08:52 PM', 'Ashutosh Das',           'Cuttack',        'Odisha',         '753001', 'returned',  'cod',                'Invoice IN-22. Returned to seller, broken on return, full loss'),
    ('171-4168885-4737928', DATE '2026-06-04', '06:02 PM', 'Siddhant Raj',           'Greater Noida',  'Uttar Pradesh',  '201310', 'completed', 'prepaid_cc',         'Invoice IN-21'),
    ('171-1856049-3886760', DATE '2026-06-04', '09:42 AM', 'Royston Pio Almeida',    'North Goa',      'Goa',            '403508', 'completed', 'prepaid_netbanking', 'Invoice IN-20'),
    ('406-2616992-6163558', DATE '2026-06-04', '03:11 AM', 'Riya Bakuli',            'Pune',           'Maharashtra',    '411020', 'returned',  'prepaid_cc',         'Invoice IN-19. Returned to seller, broken on return, full loss'),
    ('406-2737441-1611538', DATE '2026-05-31', '01:04 PM', 'Harry Parikh',           'Vadodara',       'Gujarat',        '390012', 'returned',  'prepaid_gcpaystation','Invoice IN-18. Returned to seller, broken on return, full loss'),
    ('408-0356054-2945162', DATE '2026-05-30', '01:26 PM', 'Purnendu Prakash',       'Hyderabad',      'Telangana',      '500032', 'returned',  'prepaid_cc',         'Invoice IN-17. Returned to seller, broken on return, full loss'),
    ('404-5988406-6798753', DATE '2026-05-29', '07:59 AM', 'Hokitozhimomi',          'Dimapur',        'Nagaland',       '797112', 'completed', 'prepaid',            'Invoice not in source MTR window'),
    ('406-6278544-1921945', DATE '2026-05-28', '04:46 PM', 'Hasnith',                'Hyderabad',      'Telangana',      '500075', 'completed', 'cod',                'No invoice number in source MTR window'),
    ('171-0774666-8349135', DATE '2026-05-28', '01:00 PM', 'Aheli Chakraborty',      'Panihati',       'West Bengal',    '700049', 'completed', 'prepaid',            'No invoice number in source MTR window'),
    ('408-1222195-9104356', DATE '2026-05-28', '12:19 PM', 'Yogesh Milind Bhamare',  'Nashik',         'Maharashtra',    '422006', 'returned',  'cod',                'Invoice IN-13. Returned to seller, broken on return, full loss'),
    ('404-3406099-5209920', DATE '2026-05-28', '02:31 AM', 'Ashmit',                 'New Delhi',      'Delhi',          '110048', 'completed', 'cod',                'No invoice number in source MTR window'),
    ('403-1993446-9297901', DATE '2026-05-26', '10:33 AM', 'Sijuvijay',              'Chennai',        'Tamil Nadu',     '600095', 'returned',  'cod',                'Invoice IN-11. Returned to seller, broken on return, full loss'),
    ('406-0882719-5525938', DATE '2026-05-24', '11:54 PM', 'Bhoi (joel)',            'Hyderabad',      'Telangana',      '500034', 'returned',  'prepaid_paystation', 'Invoice IN-10. Returned to seller, broken on return, full loss'),
    ('406-4240103-7857908', DATE '2026-05-24', '01:03 PM', 'Shashank',               'New Delhi',      'Delhi',          '110080', 'completed', 'cod',                'No invoice number in source MTR window'),
    ('408-8316311-5881934', DATE '2026-05-16', '01:58 AM', 'Kanika Mahajan',         'New Delhi',      'Delhi',          '110019', 'returned',  'prepaid',            'Refund applied per Amazon; no invoice/CN number found in source MTR window (outside June export range)')
)
INSERT INTO biz_sales (
  channel_id, order_id, order_date, order_time,
  customer_name, customer_city, customer_state, customer_pincode,
  product_id, product_name, sku, qty,
  selling_price, platform_fee, shipping_fee, other_deductions, cogs,
  gst_rate, status, payment_mode, notes, import_source
)
SELECT
  'amazon', o.order_id, o.order_date, o.order_time,
  o.customer_name, o.customer_city, o.customer_state, o.customer_pincode,
  p.id, p.name, 'CS-BELD-6UKD', 1,
  999.00, 87.15, 53.10, 0, 160.00,
  18.00, o.status, o.payment_mode, o.notes, 'amazon_mtr_csv'
FROM orders o
CROSS JOIN (SELECT id, name FROM biz_products WHERE sku = 'CS-BELD-6UKD') p
WHERE NOT EXISTS (SELECT 1 FROM biz_sales s WHERE s.order_id = o.order_id);

-- ── 3. Returns (8 orders, all broken on return = total loss) ───────────
-- refund_given is what Amazon actually refunded the buyer (from the order confirmation letters);
-- it sometimes exceeds ₹999 because Amazon also reversed the COD collection charge.
-- amount_lost is the seller's lost product revenue (₹999 flat, matching selling_price).
-- date = credit note date from MTR_B2C where available; Kanika Mahajan's exact refund date
-- was not present in any source report (her order predates the June MTR export window), so
-- 2026-05-20 is used as a placeholder estimate — flagged in notes.

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

-- ── 4. Stock movements (all 21 units left inventory as sales; returns are NOT ─
--       restocked since they came back broken/unsellable) ─────────────────────
INSERT INTO biz_stock_movements (product_id, movement_type, qty, unit_cost, reference_id, notes, date)
SELECT p.id, 'sale', -1, 160.00, s.order_id,
       CASE WHEN s.status = 'returned'
            THEN 'Sold then returned broken; not restocked, treated as write-off'
            ELSE 'Amazon sale' END,
       s.order_date
FROM biz_sales s
JOIN biz_products p ON p.id = s.product_id
WHERE s.sku = 'CS-BELD-6UKD'
  AND s.import_source = 'amazon_mtr_csv'
  AND NOT EXISTS (SELECT 1 FROM biz_stock_movements m WHERE m.reference_id = s.order_id AND m.movement_type = 'sale');

-- ── 5. Sanity check (run manually after import) ─────────────────────────
-- SELECT status, count(*), sum(selling_price) FROM biz_sales WHERE sku='CS-BELD-6UKD' GROUP BY status;
-- Expect: completed=13 (₹12,987.00), returned=8 (₹7,992.00), total 21 orders / ₹20,979.00
-- matching SalesDashboard-09-07-26.csv "Ordered Product Sales" total of ₹20,979.00 for 21 units.
