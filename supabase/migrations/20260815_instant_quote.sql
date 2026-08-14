-- TriAkar Instant Quote — STL/OBJ upload, automated heuristic pricing, cart/checkout integration
-- Safe, additive. Run once in Supabase SQL Editor.

-- ════════════════════════════════════════════════════════════════════════
-- 1. PUBLIC CATALOG (curated, decoupled from internal filament_inventory /
--    biz_printers so no internal cost/stock data is ever exposed to the browser)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS instant_quote_materials (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL UNIQUE,
  filament_type         TEXT NOT NULL DEFAULT 'PLA',
  color                 TEXT,
  color_hex             TEXT,
  density_g_cm3         NUMERIC(4,2) NOT NULL DEFAULT 1.24,
  cost_per_gram_public  NUMERIC(6,3) NOT NULL,
  active                BOOLEAN DEFAULT true,
  sort_order            INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instant_quote_printers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  build_x_mm   NUMERIC(6,1) NOT NULL,
  build_y_mm   NUMERIC(6,1) NOT NULL,
  build_z_mm   NUMERIC(6,1) NOT NULL,
  active       BOOLEAN DEFAULT true,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════
-- 2. QUOTE REQUESTS — one row per uploaded model + configuration + computed price
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS instant_quote_requests (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_file_url              TEXT NOT NULL,
  model_public_id             TEXT,
  file_name                   TEXT,
  file_format                 TEXT CHECK (file_format IN ('stl','obj')),
  volume_cm3                  NUMERIC(12,3),
  dims_mm                     JSONB,
  surface_area_cm2            NUMERIC(12,3),
  triangle_count              INTEGER,
  printer_id                  UUID REFERENCES instant_quote_printers(id),
  material_id                 UUID REFERENCES instant_quote_materials(id),
  infill_percent              INTEGER NOT NULL DEFAULT 20 CHECK (infill_percent BETWEEN 5 AND 100),
  estimated_print_time_hours  NUMERIC(8,2),
  estimated_weight_g          NUMERIC(10,2),
  price_breakdown             JSONB,
  final_price                 NUMERIC(10,2) NOT NULL,
  status                       TEXT NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted','in_cart','ordered','expired')),
  created_at                   TIMESTAMPTZ DEFAULT now(),
  expires_at                   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);
CREATE INDEX IF NOT EXISTS instant_quote_requests_user_idx ON instant_quote_requests(user_id);

-- ════════════════════════════════════════════════════════════════════════
-- 3. ORDER_ITEMS — allow a line item to reference EITHER a catalog product
--    OR an instant-quote request (never both null)
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS instant_quote_id UUID REFERENCES instant_quote_requests(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_product_or_quote_chk'
  ) THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_product_or_quote_chk
      CHECK (product_id IS NOT NULL OR instant_quote_id IS NOT NULL);
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════
-- 4. RLS
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE instant_quote_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instant_quote_materials_public_read ON instant_quote_materials;
CREATE POLICY instant_quote_materials_public_read ON instant_quote_materials
  FOR SELECT USING (active = true);
DROP POLICY IF EXISTS instant_quote_materials_admin_write ON instant_quote_materials;
CREATE POLICY instant_quote_materials_admin_write ON instant_quote_materials FOR ALL TO authenticated
  USING (auth.email() = 'bhaveshv918@gmail.com') WITH CHECK (auth.email() = 'bhaveshv918@gmail.com');

ALTER TABLE instant_quote_printers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instant_quote_printers_public_read ON instant_quote_printers;
CREATE POLICY instant_quote_printers_public_read ON instant_quote_printers
  FOR SELECT USING (active = true);
DROP POLICY IF EXISTS instant_quote_printers_admin_write ON instant_quote_printers;
CREATE POLICY instant_quote_printers_admin_write ON instant_quote_printers FOR ALL TO authenticated
  USING (auth.email() = 'bhaveshv918@gmail.com') WITH CHECK (auth.email() = 'bhaveshv918@gmail.com');

-- instant_quote_requests: written exclusively by the backend service-role key today
-- (POST /api/instant-quote/*), so these policies are a defence-in-depth safety net,
-- not the primary access path.
ALTER TABLE instant_quote_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instant_quote_requests_own ON instant_quote_requests;
CREATE POLICY instant_quote_requests_own ON instant_quote_requests FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS instant_quote_requests_admin ON instant_quote_requests;
CREATE POLICY instant_quote_requests_admin ON instant_quote_requests FOR ALL TO authenticated
  USING (auth.email() = 'bhaveshv918@gmail.com') WITH CHECK (auth.email() = 'bhaveshv918@gmail.com');

-- ════════════════════════════════════════════════════════════════════════
-- 5. STARTER CATALOG — admin can edit/extend from the Instant Quote admin tab
-- ════════════════════════════════════════════════════════════════════════
INSERT INTO instant_quote_materials (name, filament_type, color, color_hex, density_g_cm3, cost_per_gram_public, sort_order) VALUES
  ('PLA — Matte Black',    'PLA',  'Black',    '#0F0F0D', 1.24, 1.80, 1),
  ('PLA — Ivory White',    'PLA',  'White',    '#F4F2EC', 1.24, 1.80, 2),
  ('PETG — Charcoal',      'PETG', 'Charcoal', '#3A3A38', 1.27, 2.20, 3),
  ('TPU — Flexible Black', 'TPU',  'Black',    '#0F0F0D', 1.21, 3.20, 4)
ON CONFLICT (name) DO NOTHING;

INSERT INTO instant_quote_printers (name, build_x_mm, build_y_mm, build_z_mm, sort_order) VALUES
  ('Standard FDM (220 x 220 x 250mm)',     220, 220, 250, 1),
  ('Large-Format FDM (350 x 350 x 400mm)', 350, 350, 400, 2)
ON CONFLICT (name) DO NOTHING;
