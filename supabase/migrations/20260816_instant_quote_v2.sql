-- TriAkar Instant Quote v2 — simplified, novice-friendly configuration:
-- pure material TYPES (color picked separately), a standing color catalog,
-- printer choice reduced to 3 real bed sizes (names hidden from the customer
-- in the UI, kept here only for admin reference), nozzle size, and lead
-- capture fields (name/phone) on the quote itself.
-- Safe, additive/rebuild-catalog. Run once in Supabase SQL Editor.

-- ════════════════════════════════════════════════════════════════════════
-- 1. MATERIALS — rebuilt as pure types, no color coupling
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE instant_quote_materials DROP COLUMN IF EXISTS color;
ALTER TABLE instant_quote_materials DROP COLUMN IF EXISTS color_hex;
ALTER TABLE instant_quote_materials ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
-- Grouping shown to the customer (Regular / Good Strength / Outdoor & Durable /
-- Top Strength / Flexible), and an optional color allowlist by name — ABS/ASA
-- are only stocked in Black and White, other materials leave this NULL
-- (meaning "every active color is available").
ALTER TABLE instant_quote_materials ADD COLUMN IF NOT EXISTS material_group TEXT;
ALTER TABLE instant_quote_materials ADD COLUMN IF NOT EXISTS limited_colors TEXT[];

DELETE FROM instant_quote_materials;
-- Costs are TriAkar starting estimates, not final — edit anytime from the
-- admin Instant Quotes tab without a deploy.
INSERT INTO instant_quote_materials (name, filament_type, density_g_cm3, cost_per_gram_public, is_default, material_group, limited_colors, sort_order) VALUES
  ('PLA+',    'PLA+',    1.24, 1.70, true,  'Regular',            NULL,                    1),
  ('PLA',     'PLA',     1.24, 1.50, false, 'Regular',            NULL,                    2),
  ('PETG',    'PETG',    1.27, 1.90, false, 'Good Strength',      NULL,                    3),
  ('ABS',     'ABS',     1.04, 1.80, false, 'Outdoor & Durable',  ARRAY['Black','White'],  4),
  ('ASA',     'ASA',     1.07, 2.10, false, 'Outdoor & Durable',  ARRAY['Black','White'],  5),
  ('PLA-CF',  'PLA-CF',  1.30, 3.50, false, 'Top Strength',       NULL,                    6),
  ('PETG-HF', 'PETG-HF', 1.27, 2.20, false, 'Top Strength',       NULL,                    7),
  ('PETG-CF', 'PETG-CF', 1.35, 3.80, false, 'Top Strength',       NULL,                    8),
  ('TPU',     'TPU',     1.21, 2.80, false, 'Flexible',           NULL,                    9);

-- ════════════════════════════════════════════════════════════════════════
-- 2. COLORS — a standing catalog, independent of material (any color on
--    any material, matching how the business actually stocks filament)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS instant_quote_colors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  hex        TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  active     BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO instant_quote_colors (name, hex, is_default, sort_order) VALUES
  ('Black',  '#0F0F0D', true,  1),
  ('White',  '#F4F2EC', false, 2),
  ('Grey',   '#8A8782', false, 3),
  ('Orange', '#C4622A', false, 4),
  ('Red',    '#B3261E', false, 5),
  ('Blue',   '#2A5CAA', false, 6),
  ('Green',  '#2F6B3A', false, 7),
  ('Natural','#E8E2D0', false, 8)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE instant_quote_colors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instant_quote_colors_public_read ON instant_quote_colors;
CREATE POLICY instant_quote_colors_public_read ON instant_quote_colors FOR SELECT USING (active = true);
DROP POLICY IF EXISTS instant_quote_colors_admin_write ON instant_quote_colors;
CREATE POLICY instant_quote_colors_admin_write ON instant_quote_colors FOR ALL TO authenticated
  USING (auth.email() = 'bhaveshv918@gmail.com') WITH CHECK (auth.email() = 'bhaveshv918@gmail.com');

-- ════════════════════════════════════════════════════════════════════════
-- 3. PRINTERS — reduced to 3 real bed sizes. `name` is kept for admin
--    reference only; the customer-facing UI shows dimensions, not the name
--    ("customers don't know printer models, keep it simple").
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE instant_quote_printers ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
DELETE FROM instant_quote_printers;
INSERT INTO instant_quote_printers (name, build_x_mm, build_y_mm, build_z_mm, is_default, sort_order) VALUES
  ('Bambu Lab A1 Mini (admin ref only)',  180, 180, 180, false, 1),
  ('Bambu Lab P1S (admin ref only)',      256, 256, 256, true,  2),
  ('Snapmaker U1 (admin ref only)',       270, 270, 270, false, 3);

-- ════════════════════════════════════════════════════════════════════════
-- 4. QUOTE REQUESTS — color, nozzle, and lead-capture fields
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE instant_quote_requests ADD COLUMN IF NOT EXISTS color_id       UUID REFERENCES instant_quote_colors(id);
ALTER TABLE instant_quote_requests ADD COLUMN IF NOT EXISTS nozzle_mm      NUMERIC(3,2) NOT NULL DEFAULT 0.4;
ALTER TABLE instant_quote_requests ADD COLUMN IF NOT EXISTS layer_height_mm NUMERIC(3,2) NOT NULL DEFAULT 0.2;
ALTER TABLE instant_quote_requests ADD COLUMN IF NOT EXISTS contact_name   TEXT;
ALTER TABLE instant_quote_requests ADD COLUMN IF NOT EXISTS contact_phone  TEXT;
-- Free-text "Other" notes per config category (build size / material / color /
-- nozzle / infill), typed by the customer when none of the presets fit. Purely
-- additive: the numeric selection used for pricing is untouched, this is just
-- context for the human who reviews the order before production.
ALTER TABLE instant_quote_requests ADD COLUMN IF NOT EXISTS custom_notes TEXT;
