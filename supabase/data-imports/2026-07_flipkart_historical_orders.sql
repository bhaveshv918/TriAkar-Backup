-- ============================================================================
-- Flipkart historical order backfill — 26 orders / 27 line items
-- Source file: Order-CSV (1).csv  (period: 27-Apr-2026 .. 29-Jun-2026)
-- Run this once in the Supabase SQL editor.
--
-- This mirrors exactly what admin-biz.html's built-in Flipkart CSV importer
-- (isFlipkartReport / buildFlipkartRow in admin-biz.html) would produce, so
-- this backfilled data stays consistent with anything imported through the
-- Business OS "Import CSV" tab. In fact — the Import CSV tab already
-- recognises this exact report format out of the box (column headers
-- "Order Id" + "Invoice Amount" + "Order State"/"HSN CODE" match its
-- auto-detection), so for FUTURE Flipkart order CSVs you can just upload
-- them directly there; no SQL needed going forward. This script is only
-- for backfilling this one historical file you already have.
--
-- Field notes:
--  - selling_price = "Invoice Amount" (GST-inclusive), matching the in-app
--    importer — NOT "Selling Price Per Item".
--  - gst_rate = IGST% (every row here uses IGST only; no CGST/SGST split).
--  - product_id / cogs are looked up from biz_products by SKU match (LEFT
--    JOIN below). If a SKU isn't in your catalog yet, product_id stays
--    NULL and cogs defaults to 0 — update later via Products & Costs once
--    you set a real base_cost, then re-save the affected sales rows.
--  - shipping_fee / other_deductions replicate the app's default fee
--    tiers (₹50/₹89/₹160 by price band + ₹45 flat packing). If you have
--    custom Flipkart fee ranges configured in Fees & Costs, these won't
--    match — adjust those rows afterward.
--  - Order OD337835862633932100 (Sachin R) has TWO line items in the
--    source file (two different SKUs under one order) — inserted as two
--    biz_sales rows, same order_id, matching how the order actually shipped.
--  - Row for Aadhya Dixit (order OD337711720568411100): the source CSV's
--    Tracking ID was corrupted by Excel into scientific notation
--    ("1.34486E+12") — left NULL here rather than inserting garbage.
--    Real AWB isn't recoverable from this file; check Flipkart Seller Hub
--    if you need it.
--  - Every row is guarded by a NOT EXISTS check on (order_id, sku), so
--    re-running this script is safe and will not create duplicates.
-- ============================================================================

BEGIN;

INSERT INTO biz_sales (
  channel_id, order_id, order_date, dispatch_date, hsn_code, status, sku,
  product_id, product_name, invoice_no, gst_rate, selling_price, qty,
  customer_name, customer_address, customer_city, customer_state, customer_pincode,
  tracking_number, courier_partner, package_size, weight_grams, cogs,
  platform_fee, shipping_fee, other_deductions, import_source
)
SELECT
  v.channel_id, v.order_id, v.order_date, v.dispatch_date, v.hsn_code, v.status, v.sku,
  bp.id, v.product_name, v.invoice_no, v.gst_rate, v.selling_price, v.qty,
  v.customer_name, v.customer_address, v.customer_city, v.customer_state, v.customer_pincode,
  v.tracking_number, v.courier_partner, v.package_size, v.weight_grams,
  COALESCE(bp.base_cost, 0),
  0, v.shipping_fee, v.other_deductions, 'flipkart_csv'
FROM (VALUES
  -- channel_id, order_id, order_date, dispatch_date, hsn_code, status, sku,
  -- product_name, invoice_no, gst_rate, selling_price, qty,
  -- customer_name, customer_address, customer_city, customer_state, customer_pincode,
  -- tracking_number, courier_partner, package_size, weight_grams,
  -- shipping_fee, other_deductions
  ('flipkart','OD437930939837894100','2026-06-26'::date,'2026-06-30'::date,'3926','completed','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1','LWAEB62270000046',18.00,928.00,1,
   'Prasad Deshpande','B-202, Pratibha Sankalp Society, SANKALP SOCIETY, Sankalp Colony, Malad East','Mumbai','Maharashtra','400097',
   'FMPP4107633050','ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD337948349383098100','2026-06-28'::date,'2026-06-29'::date,'3926','completed','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1','LWAEB62270000045',18.00,909.00,1,
   'Sanjay TB','Laxmi venkateshwara nelaya, jayanagar, Thar road, kanti store road, near wear house','Krishnarajpet','Karnataka','571426',
   'FMPP4104977931','ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD437921055025041100','2026-06-25'::date,'2026-06-25'::date,'3926','completed','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1','LWAEB62270000040',18.00,928.00,1,
   'Aravind CS','Anugraha, janani nagar 122, Koottani Kadapakkada','Kollam','Kerala','691008',
   'FMPP4099439417','ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD437912490779993100','2026-06-24'::date,'2026-06-25'::date,'3926','completed','TAF/FIG/BAT/BLK/047',
   'TRIAKAR Decorative Showpiece - 14 cm TAK-FG-BAT-BK-S1','LWAEB62270000039',18.00,1278.50,1,
   'Aravind CS','Anugraha, janani nagar 122, Koottani Kadapakkada','Kollam','Kerala','691008',
   'FMPP4097707978','ekart','18×11×9 cm',250,160.00,45.00),

  ('flipkart','OD437961063581670100','2026-06-29'::date,'2026-07-01'::date,'3926','returned','TAF/FIG/BAT/BLK/047',
   'TRIAKAR Decorative Showpiece - 14 cm TAK-FG-BAT-BK-S1','LWAEB62270000047',18.00,1178.00,1,
   'Bhargavi','Flat no 402, PNS Residency, Gandhinagar colony, Upperpally','HYDERABAD','Telangana','500030',
   'FMPP4108193489','ekart','18×11×9 cm',250,160.00,45.00),

  ('flipkart','OD337939579407445100','2026-06-27'::date,'2026-06-29'::date,'3926','completed','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1','LWAEB62270000044',18.00,927.00,1,
   'Nitin Sharma','C23 shivalik nagar bhel ranipur haridwar, C Cluster, Saleempur Chowk, Shivalik Nagar','Haridwar','Uttarakhand','249403',
   'FMPC6241582804','ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD437862995176748100','2026-06-18'::date,'2026-06-19'::date,'3926','completed','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1','LWAEB62270000037',18.00,923.00,1,
   'Saravanan','Pelican cafe, 5th Street, river view residency, karapakkam','Chennai','Tamil Nadu','600097',
   'SF3206611013F','ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD337864256226150100','2026-06-18'::date,'2026-06-19'::date,'3926','completed','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1','LWAEB62270000038',18.00,907.00,1,
   'Vishnu Prasad','Vishnuvilasam.manakkara north,sasthamcotta, Manakkara, Sasthamcotta, Near Aster PMF Hospital','Kollam','Kerala','690521',
   'FMPP4087115515','ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD437826837047206100','2026-06-14'::date,'2026-06-16'::date,'3926','completed','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2','LWAEB62270000025',18.00,891.00,1,
   'Aravind CS','Anugraha, janani nagar 122, Koottani Kadapakkada','Kollam','Kerala','691008',
   'FMPP4080341698','ekart','18×18×18 cm',300,89.00,45.00),

  ('flipkart','OD437840157731874100','2026-06-15'::date,'2026-06-16'::date,'3926','completed','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1','LWAEB62270000032',18.00,843.50,1,
   'Sakthivel','no;83b sathya nager 3rd street chennai, pillayar kovil','Chennai','Tamil Nadu','600050',
   'FMPC6207695755','ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD337835862633932100','2026-06-15'::date,'2026-06-16'::date,'3926','completed','TAF/FIG/BAT/BLK/047',
   'TRIAKAR Decorative Showpiece - 14 cm TAK-FG-BAT-BK-S1','LWAEB62270000023',18.00,882.00,1,
   'Sachin R','73/1 Jeenugudu nilaya, TR NAGAR, NETAJI ROAD near deeksha college','BANGALORE','Karnataka','560028',
   'FMPP4080146299','ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD337835862633932100','2026-06-15'::date,'2026-06-16'::date,'3926','completed','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2','LWAEB62270000024',18.00,898.00,1,
   'Sachin R','73/1 Jeenugudu nilaya, TR NAGAR, NETAJI ROAD near deeksha college','BANGALORE','Karnataka','560028',
   'FMPP4080337867','ekart','18×18×18 cm',300,89.00,45.00),

  ('flipkart','OD337831898226416100','2026-06-15'::date,'2026-06-16'::date,'3926','completed','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2','LWAEB62270000026',18.00,925.00,1,
   'Richard N','4-10/6 Buddha Nagar Road no 3 Boduppal, Lane opp to lifespring maternity hospital (dead end)','Hyderabad','Telangana','500098',
   'FMPC6204878248','ekart','18×18×18 cm',300,89.00,45.00),

  ('flipkart','OD437839006876535100','2026-06-15'::date,'2026-06-16'::date,'3926','completed','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1','LWAEB62270000033',18.00,833.50,1,
   'Mohamed Kaif','No: 10, Shankaralaya, 3rd Cross St, R K Nagar, Mandaveli, Chennai, Tamil Nadu 600028, Mandaveli','CHENNAI','Tamil Nadu','600028',
   'FMPP4082224565','ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD437840708400371100','2026-06-16'::date,'2026-06-16'::date,'3926','completed','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1','LWAEB62270000031',18.00,831.50,1,
   'Aditya Deshmukh','503/Rajendra Society 5th floor above Sawant Hospital, Shastri Nagar, Juni Dombivli Road, Dombivli West, Dombivli','Thane','Maharashtra','421202',
   'FMPP4082218328','ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD337831757388183100','2026-06-15'::date,'2026-06-17'::date,'3926','completed','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2','LWAEB62270000035',18.00,906.00,1,
   'Farhan','Flat 1108, Iris Countryside, Cluster_thane_133, Ram Mandir Road, Kasarvadavali, Thane West','Thane','Maharashtra','400615',
   'FMPP4082514284','ekart','18×18×18 cm',300,89.00,45.00),

  ('flipkart','OD337827636220724100','2026-06-14'::date,'2026-06-17'::date,'3926','completed','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1','LWAEB62270000036',18.00,833.50,1,
   'Abhigyan Parashar','282, Pocket 2, Palmcity Apartments, Sector 23, Rohini, New Delhi- 110085, Near heritage school','New Delhi','Delhi','110085',
   'FMPP4082518886','ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD337791696224513100','2026-06-10'::date,'2026-06-11'::date,'3926','completed','TAF/PLN/STL/BLK/374',
   'TRIAKAR Plant Container Set Black TAK-PL-STL-BK-S2','LWAEB62270000019',18.00,1733.00,2,
   'Lala Ralte','J-52 Providence School,Lower Chawnpui,Aizawl Mizoram, Chawngvawr Resord Road','Aizawl','Mizoram','796009',
   'FMPC6190641000','ekart','11×11×11 cm',400,89.00,45.00),

  ('flipkart','OD337803556011567100','2026-06-11'::date,'2026-06-12'::date,'3926','completed','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2','LWAEB62270000022',18.00,893.00,1,
   'Rohan Satpute','96 Nilaya, Flat-301, Third Floor, 28th Main Road, 18th Cross Road, Sector 2, 18th Cross Road, HSR Layout','Bengaluru','Karnataka','560102',
   'FMPP4072942079','ekart','18×18×18 cm',300,89.00,45.00),

  ('flipkart','OD437792983113364100','2026-06-10'::date,'2026-06-11'::date,'3926','completed','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2','LWAEB62270000018',18.00,891.00,1,
   'Ishan Ranjan Mohapatra','Homely Homes Tranquil Apartment, flat TF08, BDS Layout, 2nd Cross Road, Sri Balaji Krupa Layout, RK Hegde Nagar','Bengaluru','Karnataka','560077',
   'FMPP4070539849','ekart','18×18×18 cm',300,89.00,45.00),

  ('flipkart','OD337711720568411100','2026-06-01'::date,'2026-06-02'::date,'3926','completed','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1','LWAEB62270000013',18.00,865.00,1,
   'Aadhya Dixit','paradise apartment f1 b4 second floor 214, Sector 3, Jagatguru Aadi Shankracharya Marg, Sector 1A, Nerul, Navi Mumbai','Thane','Maharashtra','400706',
   NULL,'ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD437693016411513100','2026-05-29'::date,'2026-05-30'::date,'3926','returned','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2','LWAEB62270000011',18.00,908.00,1,
   'Aditya Patil','C-302, Swapnalok Towers, Malad East, Film City Road, Near Pimpripada Fish Market','Mumbai','Maharashtra','400097',
   'FMPP4045074393','ekart','18×18×18 cm',300,89.00,45.00),

  ('flipkart','OD437590073823892100','2026-05-18'::date,'2026-05-19'::date,'3926','completed','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2','LWAEB62270000008',18.00,1148.00,1,
   'Ranjan Ghadei','Flat 303, Opal Skanda Habitat, Muniswammy Shetty Layout Rd,, Seetharampalya, Seetharampalya - Hoodi Road, Mahadevapura','Bengaluru','Karnataka','560048',
   'FMPP4018077659','ekart','18×18×18 cm',300,160.00,45.00),

  ('flipkart','OD337536770056639100','2026-05-11'::date,'2026-05-12'::date,'3926','returned','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1','LWAEB62270000007',18.00,864.50,1,
   'Tobias Rieper','Flat No. 81213, Tower 8, Nikoo Homes 1, Bhartiya City, Kannur','Bengaluru','Karnataka','560064',
   'FMPP3996342793','ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD337534829859422100','2026-05-11'::date,'2026-05-12'::date,'3926','completed','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2','LWAEB62270000006',18.00,1192.50,1,
   'Miruthula','2/53, north street, North Poigai nallur Nagapattinam, Nagapattinam Subdistrict','Nagapattinam District','Tamil Nadu','611106',
   'SF3082230688F','ekart','18×18×18 cm',300,160.00,45.00),

  ('flipkart','OD437521778821909100','2026-05-10'::date,'2026-05-11'::date,'3926','completed','TAF/FIG/BAT/BLK/023',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S1','LWAEB62270000004',18.00,864.50,1,
   'Ankita Sarkar','Champahati, panchanantata, near rail station, Panchanantata','Champahati','West Bengal','743330',
   'FMPC6081752272','ekart','18×11×9 cm',250,89.00,45.00),

  ('flipkart','OD337416894117035100','2026-04-27'::date,'2026-04-28'::date,'3926','completed','TAF/FIG/BAT/BLK/051',
   'TRIAKAR Decorative Showpiece - 13 cm TAK-FG-BAT-BK-S2','LWAEB62270000001',18.00,1000.00,1,
   'Anupam Charley','No18, 8th cross street, Phase 2, Vijayendra Nagar, telephone nagar, perungudi, Chennai, TAMIL NADU 600096, India, New India Colony, Rajiv Gandhi Salai, Perungudi','Chennai','Tamil Nadu','600096',
   'FMPP3953989398','ekart','18×18×18 cm',300,89.00,45.00)

) AS v(
  channel_id, order_id, order_date, dispatch_date, hsn_code, status, sku,
  product_name, invoice_no, gst_rate, selling_price, qty,
  customer_name, customer_address, customer_city, customer_state, customer_pincode,
  tracking_number, courier_partner, package_size, weight_grams,
  shipping_fee, other_deductions
)
LEFT JOIN biz_products bp ON bp.sku = v.sku
WHERE NOT EXISTS (
  SELECT 1 FROM biz_sales s WHERE s.order_id = v.order_id AND s.sku = v.sku
);

COMMIT;

-- ── VERIFY ───────────────────────────────────────────────────────────────
-- SELECT order_id, sku, product_name, selling_price, status, order_date
--   FROM biz_sales WHERE import_source='flipkart_csv'
--   ORDER BY order_date DESC;
-- ============================================================================
