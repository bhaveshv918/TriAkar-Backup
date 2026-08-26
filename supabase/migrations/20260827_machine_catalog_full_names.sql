-- TriAkar : full product names on the machine catalogue
--
-- The supplier's shop page truncated its own product titles ("Bambu Lab H2D Combo …"),
-- so 20260826_machine_catalog_prices.sql loaded them verbatim rather than guessing. This
-- completes them, at your instruction, from the model line-up and the listing prices:
-- the two identical "H2D Combo …" rows are the 10W and 40W laser combos, separated by
-- their price (2,93,999 and 3,69,999), and the same pattern resolves the H2C pair.
--
-- Names are stored so that brand + model + variant reads as one product title, which is
-- what the picker shows and what lands on the invoice line:
--
--   Bambu Lab A2L 3D Printer
--   Bambu Lab A1 Mini Combo (with AMS Lite)
--   Bambu Lab H2D Laser Full Combo 40W
--
-- Prices, HSN, GST and anything you have edited are untouched. Only the naming and the
-- "name truncated" notes are rewritten.
--
-- Run after 20260826_machine_catalog_prices.sql. Idempotent: re-running matches nothing
-- the second time (the old names are gone) and changes nothing.
-- ════════════════════════════════════════════════════════════════════════════════

UPDATE public.biz_machine_catalog SET model = 'A1 Mini', variant = '3D Printer', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'A1 mini' AND variant IS NULL;
UPDATE public.biz_machine_catalog SET model = 'A1 Mini', variant = 'Combo (with AMS Lite)', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'A1 mini' AND variant = 'Combo …';
UPDATE public.biz_machine_catalog SET model = 'A1', variant = 'Combo (with AMS Lite)', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'A1' AND variant = 'Combo - Wit…';
UPDATE public.biz_machine_catalog SET model = 'A1', variant = '3D Printer', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'A1' AND variant IS NULL;
UPDATE public.biz_machine_catalog SET model = 'A2L', variant = '3D Printer', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'A2L' AND variant IS NULL;
UPDATE public.biz_machine_catalog SET model = 'A2L', variant = 'Combo (with AMS Lite)', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'A2L' AND variant = 'Combo…';
UPDATE public.biz_machine_catalog SET model = 'P1P', variant = '3D Printer', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'P1P' AND variant IS NULL;
UPDATE public.biz_machine_catalog SET model = 'P1S', variant = '3D Printer', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'P1S' AND variant IS NULL;
UPDATE public.biz_machine_catalog SET model = 'P1S', variant = 'Combo (with AMS)', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'P1S' AND variant = 'Combo …';
UPDATE public.biz_machine_catalog SET model = 'P1S', variant = 'Combo (with AMS 2 Pro)', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'P1S' AND variant = 'With AM…';
UPDATE public.biz_machine_catalog SET model = 'P2S', variant = '3D Printer', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'P2S' AND variant IS NULL;
UPDATE public.biz_machine_catalog SET model = 'P2S', variant = 'Combo (with AMS 2 Pro)', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'P2S' AND variant = 'Combo…';
UPDATE public.biz_machine_catalog SET model = 'X1-Carbon', variant = '3D Printer', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'X1 Carbon' AND variant = '3…';
UPDATE public.biz_machine_catalog SET model = 'X1-Carbon', variant = 'Combo (with AMS)', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'X1 Carbon' AND variant = '(variant truncated)';
UPDATE public.biz_machine_catalog SET model = 'X1E', variant = '3D Printer', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'X1E' AND variant IS NULL;
UPDATE public.biz_machine_catalog SET model = 'X2D', variant = '3D Printer', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'X2D' AND variant IS NULL;
UPDATE public.biz_machine_catalog SET model = 'X2D', variant = 'Combo (with AMS 2 Pro)', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'X2D' AND variant = 'Combo…';
UPDATE public.biz_machine_catalog SET model = 'H2D', variant = '3D Printer', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'H2D' AND variant IS NULL;
UPDATE public.biz_machine_catalog SET model = 'H2D', variant = 'Combo (with AMS 2 Pro)', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'H2D' AND variant = 'AMS…';
UPDATE public.biz_machine_catalog SET model = 'H2D', variant = 'Laser Full Combo 10W', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'H2D' AND variant = 'Combo … (2,93,999 listing)';
UPDATE public.biz_machine_catalog SET model = 'H2D', variant = 'Laser Full Combo 40W', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'H2D' AND variant = 'Combo … (3,69,999 listing)';
UPDATE public.biz_machine_catalog SET model = 'H2D Pro', variant = '3D Printer', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'H2D' AND variant = 'Pro…';
UPDATE public.biz_machine_catalog SET model = 'H2S', variant = '3D Printer', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'H2S' AND variant IS NULL;
UPDATE public.biz_machine_catalog SET model = 'H2S', variant = 'Combo (with AMS 2 Pro)', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'H2S' AND variant = 'Combo…';
UPDATE public.biz_machine_catalog SET model = 'H2S', variant = 'Laser Full Combo', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'H2S' AND variant = 'Laser Fu…';
UPDATE public.biz_machine_catalog SET model = 'H2C', variant = 'Combo (with AMS 2 Pro)', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'H2C' AND variant = 'AMS…';
UPDATE public.biz_machine_catalog SET model = 'H2C', variant = 'Laser Full Combo 10W', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'H2C' AND variant = '10W…';
UPDATE public.biz_machine_catalog SET model = 'H2C', variant = 'Laser Full Combo 40W', updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'H2C' AND variant = '40W…';
UPDATE public.biz_machine_catalog SET model = 'Refurbished 3D Printer', variant = NULL, updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'Refurbished (model truncated)' AND variant IS NULL;
UPDATE public.biz_machine_catalog SET model = 'AMS 2 Pro', variant = NULL, updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'AMS 2 Pro' AND variant IS NULL;
UPDATE public.biz_machine_catalog SET model = 'AMS HT', variant = NULL, updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'AMS HT' AND variant = '-…';
UPDATE public.biz_machine_catalog SET model = 'AMS Lite', variant = NULL, updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'AMS lite' AND variant = '-…';
UPDATE public.biz_machine_catalog SET model = 'AMS', variant = NULL, updated_at = now()
 WHERE brand = 'Bambu Lab' AND model = 'AMS' AND variant = '-…';

-- The truncation warning is no longer true, so it goes. A note that was only ever about
-- the missing name is cleared outright; a row that also carried a real note (out of
-- stock, pre-booking) keeps that part.
UPDATE public.biz_machine_catalog
   SET notes = NULLIF(trim(both '; ' FROM
         replace(notes, 'Name truncated in the source price list, complete it before invoicing', '')), ''),
       updated_at = now()
 WHERE notes LIKE '%Name truncated%';

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
--   SELECT concat_ws(' ', brand, model, variant) AS product, selling_price, hsn_code
--     FROM biz_machine_catalog ORDER BY sort_order;
-- Expect 33 rows, every name complete, no ellipsis anywhere.
--   SELECT count(*) FROM biz_machine_catalog WHERE variant LIKE '%…%' OR model LIKE '%…%';
-- Expect 0.
-- ════════════════════════════════════════════════════════════════════════════════
