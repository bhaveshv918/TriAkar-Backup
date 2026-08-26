-- TriAkar : catalogue of machines TriAkar resells (Bambu Lab printers, AMS units, spares)
--
-- Add Order already has a "Machine" line type, but it was a free-text box: every printer
-- sale meant typing the model name, remembering the price, and remembering that a printer
-- is HSN 8485 at 18% GST, not the 3926 default that fits 3D-printed goods. One wrong HSN
-- there lands in GSTR-1 Table 12 and has to be unpicked later.
--
-- This table is the price list behind that box. Picking a machine fills in the name, the
-- rate, the cost (so margin is real), the GST rate and the HSN in one click, for both
-- Add Order and Quotation mode, which share the same items grid.
--
-- Deliberately separate from:
--   biz_printers            the machines TriAkar prints on (an asset, feeds Balance Sheet)
--   instant_quote_printers  the build volumes offered on the public Instant Quote
--   biz_products            3D-printed goods TriAkar makes (no purchase/resale price pair)
--
-- Idempotent, safe to run more than once. Re-running never overwrites prices you have
-- edited: the seed only inserts models that are not in the table yet.
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.biz_machine_catalog (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand         TEXT NOT NULL DEFAULT 'Bambu Lab',
  model         TEXT NOT NULL,                    -- 'X1 Carbon'
  variant       TEXT,                             -- 'Combo (with AMS 2 Pro)', NULL for the base unit
  sku           TEXT,                             -- your own SKU / the supplier's part number
  category      TEXT NOT NULL DEFAULT 'printer'
                  CHECK (category IN ('printer','ams','accessory','spare')),
  specs         TEXT,                             -- one line shown under the name while quoting

  -- Money. selling_price is the TAXABLE rate (GST excluded), matching what the Add Order
  -- "Rate" column expects, so nothing has to be back-computed at save time. The catalogue
  -- UI lets you type the GST-inclusive figure instead and converts it, because that is the
  -- form supplier and marketplace price lists usually arrive in.
  purchase_cost NUMERIC(12,2),                    -- what TriAkar pays, feeds the line's Cost, so margin is real
  selling_price NUMERIC(12,2),                    -- default rate charged, GST excluded
  mrp           NUMERIC(12,2),                    -- list price incl GST, for "MRP x, you pay y" on a quote

  -- Tax. 8485 is the additive-manufacturing heading; kept per row because AMS units,
  -- spares and accessories do not all sit under the same code.
  hsn_code      TEXT NOT NULL DEFAULT '8485',
  gst_rate      NUMERIC(5,2) NOT NULL DEFAULT 18,

  active        BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per brand + model + variant. Also what the seed below keys off, so a second run
-- is a no-op instead of a duplicate list. COALESCE because NULL variant (the base unit)
-- would otherwise never collide with itself under a plain unique constraint.
CREATE UNIQUE INDEX IF NOT EXISTS biz_machine_catalog_identity
  ON public.biz_machine_catalog (brand, model, COALESCE(variant, ''));

CREATE INDEX IF NOT EXISTS biz_machine_catalog_active_sort
  ON public.biz_machine_catalog (active, sort_order);

ALTER TABLE public.biz_machine_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "biz_staff_or_admin" ON public.biz_machine_catalog;
CREATE POLICY "biz_staff_or_admin" ON public.biz_machine_catalog
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com' OR public.is_biz_staff())
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com' OR public.is_biz_staff());

-- ── SEED, Bambu Lab line-up ──────────────────────────────────────────────────────
-- Names, specs and ordering only. Every price column is left NULL on purpose: fill them
-- in from your own supplier price list under Products, Machine Catalogue. A machine with
-- no selling price still picks correctly in Add Order, it just leaves the Rate blank for
-- you to type, rather than quoting a number nobody checked.
--
-- Anything missing from this list (a new release, a bundle a supplier quotes as one SKU,
-- a non-Bambu machine) is added from the same screen, this seed is a starting point.
INSERT INTO public.biz_machine_catalog (brand, model, variant, category, specs, sort_order) VALUES
  ('Bambu Lab','A1 mini',  NULL,                        'printer','180x180x180mm, bed slinger, single colour',      10),
  ('Bambu Lab','A1 mini',  'Combo (with AMS lite)',     'printer','180x180x180mm, 4 colour via AMS lite',           11),
  ('Bambu Lab','A1',       NULL,                        'printer','256x256x256mm, bed slinger, single colour',      20),
  ('Bambu Lab','A1',       'Combo (with AMS lite)',     'printer','256x256x256mm, 4 colour via AMS lite',           21),
  ('Bambu Lab','P1P',      NULL,                        'printer','256x256x256mm, open frame, CoreXY',              30),
  ('Bambu Lab','P1S',      NULL,                        'printer','256x256x256mm, enclosed, CoreXY',                40),
  ('Bambu Lab','P1S',      'Combo (with AMS)',          'printer','256x256x256mm, enclosed, 4 colour via AMS',       41),
  ('Bambu Lab','X1 Carbon',NULL,                        'printer','256x256x256mm, enclosed, lidar, hardened nozzle',50),
  ('Bambu Lab','X1 Carbon','Combo (with AMS)',          'printer','256x256x256mm, enclosed, 4 colour via AMS',       51),
  ('Bambu Lab','X1E',      NULL,                        'printer','256x256x256mm, enterprise, air filtration',      60),
  ('Bambu Lab','H2D',      NULL,                        'printer','325x320x325mm, dual nozzle',                     70),
  ('Bambu Lab','H2D',      'Combo (with AMS 2 Pro)',    'printer','325x320x325mm, dual nozzle, 4 colour',            71),
  ('Bambu Lab','H2D',      'Laser Full Combo 10W',      'printer','dual nozzle + 10W laser module',                  72),
  ('Bambu Lab','H2D',      'Laser Full Combo 40W',      'printer','dual nozzle + 40W laser module',                  73),
  ('Bambu Lab','H2S',      NULL,                        'printer','single nozzle, large format',                     80),
  ('Bambu Lab','AMS 2 Pro',NULL,                        'ams',    '4 spool, active drying',                         110),
  ('Bambu Lab','AMS HT',   NULL,                        'ams',    'single spool, high temperature drying',          111),
  ('Bambu Lab','AMS lite', NULL,                        'ams',    '4 spool, for A1 / A1 mini',                      112),
  ('Bambu Lab','AMS',      NULL,                        'ams',    '4 spool, for P1 / X1 series',                     113)
ON CONFLICT (brand, model, COALESCE(variant, '')) DO NOTHING;

-- ── Remember which catalogue row a sold line came from ───────────────────────────
-- The line's name/rate/HSN are copied onto the sale (editing a price later must never
-- rewrite an invoice already raised), but the link is what lets re-opening an order show
-- the machine still selected in the picker, and what makes "which models actually sell"
-- answerable later. ON DELETE SET NULL: removing a discontinued model from the catalogue
-- must not touch the sales history that referenced it.
-- Sits on biz_sales, which is one row per line item, alongside the item_type/spool_sale_id
-- added in 20260811_biz_sales_machine_spool.sql.
ALTER TABLE public.biz_sales
  ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES public.biz_machine_catalog(id) ON DELETE SET NULL;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
--   SELECT model, variant, category, selling_price, hsn_code FROM biz_machine_catalog
--    ORDER BY sort_order;
-- Expect 19 rows, every price NULL until you enter your own.
-- ════════════════════════════════════════════════════════════════════════════════
