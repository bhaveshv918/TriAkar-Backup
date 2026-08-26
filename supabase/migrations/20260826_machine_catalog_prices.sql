-- TriAkar : real Bambu Lab price list + the HSN codes that actually apply
--
-- Follows 20260826_biz_machine_catalog.sql, which seeded model names with every price
-- left NULL. This fills them in from the supplier price list (WOL3D listing, captured
-- 2026-08-26) and corrects the tax side:
--
--   84775900  printers and AMS units  (was seeded as a placeholder 8485)
--   3916      filament sold on as a spool, set in the Add Order line, not here
--
-- Prices on that listing are the customer-facing, GST-inclusive figures. selling_price on
-- this table is the TAXABLE rate, which is what Add Order's Rate column expects, so each
-- one is stored as listed / 1.18 and mrp keeps the struck-through figure as listed. The
-- catalogue screen shows both, and typing into either box re-derives the other.
--
-- These are list prices, not TriAkar's cost. purchase_cost stays NULL until the dealer
-- price is entered, so no margin figure is claimed that nobody has checked.
--
-- Idempotent, safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Tax side first, so it applies to any row already added by hand as well.
ALTER TABLE public.biz_machine_catalog ALTER COLUMN hsn_code SET DEFAULT '84775900';
UPDATE public.biz_machine_catalog SET hsn_code = '84775900' WHERE hsn_code = '8485';

-- 2. Clear the placeholder seed. Scoped to rows nobody has touched (no price of any kind
--    entered), so a row you have already priced or edited is never thrown away. The real
--    list below uses the supplier's own naming, which does not line up one-to-one with
--    the guessed variant names in the first seed.
DELETE FROM public.biz_machine_catalog
 WHERE selling_price IS NULL AND purchase_cost IS NULL AND mrp IS NULL
   AND id NOT IN (SELECT machine_id FROM public.biz_sales WHERE machine_id IS NOT NULL);

-- 3. The list as printed. sort_order is assigned by category then price, so the catalogue
--    and the Add Order picker both read cheapest-first within printers, then AMS units.
--
--    A number of listing titles were cut off by the shop page itself ("Bambu Lab H2D
--    Combo …"), so the variant column carries the truncated text verbatim with a note,
--    rather than a guess at what the full name was. Complete those before invoicing.
INSERT INTO public.biz_machine_catalog
  (brand, model, variant, category, selling_price, mrp, notes)
VALUES
  ('Bambu Lab', 'A1 mini', NULL, 'printer', 18219.49, NULL, 'Pre-booking on the WOL3D listing, dispatch after 30 Aug'),
  ('Bambu Lab', 'A1 mini', 'Combo …', 'printer', 30931.36, 38499.00, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'A1', 'Combo - Wit…', 'printer', 38982.20, 48999.00, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'P1S', NULL, 'printer', 43219.49, 52499.00, NULL),
  ('Bambu Lab', 'P1S', 'Combo …', 'printer', 58473.73, 69999.00, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'A1', NULL, 'printer', 25422.88, 31999.00, NULL),
  ('Bambu Lab', 'H2D', 'Combo … (3,69,999 listing)', 'printer', 313558.47, 380999.00, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'H2D', 'Combo … (2,93,999 listing)', 'printer', 249151.69, 318999.00, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'H2D', 'AMS…', 'printer', 193219.49, 246999.00, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'X2D', NULL, 'printer', 83897.46, NULL, NULL),
  ('Bambu Lab', 'P2S', 'Combo…', 'printer', 80507.63, 102999.00, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'A2L', 'Combo…', 'printer', 55931.36, NULL, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'A2L', NULL, 'printer', 41524.58, NULL, NULL),
  ('Bambu Lab', 'X2D', 'Combo…', 'printer', 112711.02, NULL, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'H2C', 'AMS…', 'printer', 262711.02, NULL, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'P2S', NULL, 'printer', 57626.27, 71999.00, NULL),
  ('Bambu Lab', 'H2D', 'Pro…', 'printer', 338982.20, NULL, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'AMS 2 Pro', NULL, 'ams', 33897.46, 45999.00, NULL),
  ('Bambu Lab', 'H2S', NULL, 'printer', 126270.34, 154999.00, NULL),
  ('Bambu Lab', 'H2D', NULL, 'printer', 173727.97, 219999.00, NULL),
  ('Bambu Lab', 'H2S', 'Laser Fu…', 'printer', 205931.36, NULL, 'Name truncated in the source price list, complete it before invoicing; Out of stock on the WOL3D listing'),
  ('Bambu Lab', 'H2S', 'Combo…', 'printer', 142372.03, NULL, 'Name truncated in the source price list, complete it before invoicing; Out of stock on the WOL3D listing'),
  ('Bambu Lab', 'H2C', '40W…', 'printer', 372880.51, NULL, 'Name truncated in the source price list, complete it before invoicing; Out of stock on the WOL3D listing'),
  ('Bambu Lab', 'H2C', '10W…', 'printer', 313558.47, NULL, 'Name truncated in the source price list, complete it before invoicing; Out of stock on the WOL3D listing'),
  ('Bambu Lab', 'P1S', 'With AM…', 'printer', 81355.08, NULL, 'Name truncated in the source price list, complete it before invoicing; Out of stock on the WOL3D listing'),
  ('Bambu Lab', 'Refurbished (model truncated)', NULL, 'printer', 55931.36, 75999.00, 'Name truncated in the source price list, complete it before invoicing; Listing title truncated, only ''Refurbished Bambu Lab…'' was legible'),
  ('Bambu Lab', 'AMS HT', '-…', 'ams', 14405.93, 19999.00, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'AMS lite', '-…', 'ams', 18643.22, 24999.00, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'X1 Carbon', '3…', 'printer', 109321.19, NULL, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'AMS', '-…', 'ams', 22880.51, 30999.00, 'Name truncated in the source price list, complete it before invoicing'),
  ('Bambu Lab', 'X1E', NULL, 'printer', 253389.83, 699999.00, 'Out of stock on the WOL3D listing'),
  ('Bambu Lab', 'P1P', NULL, 'printer', 38982.20, 91999.00, 'Out of stock on the WOL3D listing'),
  ('Bambu Lab', 'X1 Carbon', '(variant truncated)', 'printer', 127117.80, NULL, 'Name truncated in the source price list, complete it before invoicing; Out of stock on the WOL3D listing')
ON CONFLICT (brand, model, COALESCE(variant, '')) DO UPDATE SET
  selling_price = EXCLUDED.selling_price,
  mrp           = EXCLUDED.mrp,
  category      = EXCLUDED.category,
  notes         = EXCLUDED.notes,
  updated_at    = now();

-- 4. Cheapest first within each category, so the picker opens on the entry-level machines.
UPDATE public.biz_machine_catalog SET sort_order = s.rn
  FROM (SELECT id, (CASE category WHEN 'printer' THEN 0 WHEN 'ams' THEN 1000 WHEN 'accessory' THEN 2000 ELSE 3000 END
                    + row_number() OVER (PARTITION BY category ORDER BY selling_price NULLS LAST)) AS rn
          FROM public.biz_machine_catalog) s
 WHERE biz_machine_catalog.id = s.id;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
--   SELECT model, variant, selling_price,
--          round(selling_price * 1.18, 0) AS incl_gst, mrp, hsn_code
--     FROM biz_machine_catalog ORDER BY sort_order;
-- Expect 33 rows, every one priced, hsn_code 84775900 throughout. incl_gst should read
-- back as the figure on the supplier listing (A1 mini 21,499, H2D 2,04,999, and so on).
-- ════════════════════════════════════════════════════════════════════════════════
