-- Prototyping page: real purchasable products (cart + Razorpay checkout, no
-- new backend price logic, reuses the existing secure products pipeline) and
-- a gallery table for admin-managed example photos.
-- Run this in the Supabase SQL Editor before the "Add to Cart" flow on
-- /prototyping.html or the gallery admin section will work.

-- ── Products ────────────────────────────────────────────────────────────
-- Starter and Enclosed Box have a real PLA+/ABS price difference (+Rs 699),
-- so each gets two SKUs. Multi-Part and Full Development already include
-- either material at no extra cost, so material is a single customization
-- field on one SKU instead of a second product row.
INSERT INTO products (
  name, slug, description, price, category, material, stock_qty, stock_status,
  is_customizable, is_active, customization_fields
) VALUES
(
  'Prototyping — Starter (PLA+)', 'prototyping-starter-pla',
  'Fixed-price single-part functional prototype. We design it from your idea, sketch or reference, up to 15x15x15cm, PLA+, 1 piece included.',
  2999, 'prototyping', 'PLA+', 999, 'Made to Order', true, true,
  '[
    {"label":"What are you prototyping?","type":"textarea","required":true,"placeholder":"Describe the idea: what it is, what it is for, and any size or colour requirements."},
    {"label":"Electronics / components inside","type":"textarea","required":false,"placeholder":"List any PCB, buttons, battery, display, wiring, sizes/quantities/placement. Write None if purely mechanical."}
  ]'::jsonb
),
(
  'Prototyping — Starter (ABS)', 'prototyping-starter-abs',
  'Fixed-price single-part functional prototype in ABS for heat/impact resistance. We design it from your idea, sketch or reference, up to 15x15x15cm, 1 piece included.',
  3698, 'prototyping', 'ABS', 999, 'Made to Order', true, true,
  '[
    {"label":"What are you prototyping?","type":"textarea","required":true,"placeholder":"Describe the idea: what it is, what it is for, and any size or colour requirements."},
    {"label":"Electronics / components inside","type":"textarea","required":false,"placeholder":"List any PCB, buttons, battery, display, wiring, sizes/quantities/placement. Write None if purely mechanical."}
  ]'::jsonb
),
(
  'Prototyping — Enclosed Box (PLA+)', 'prototyping-enclosed-pla',
  'Fixed-price enclosed box prototype, built to your spec. A box is 2 parts, lid + back, 1 complete box included, single colour, up to 23x23x23cm, PLA+.',
  4999, 'prototyping', 'PLA+', 999, 'Made to Order', true, true,
  '[
    {"label":"What are you prototyping?","type":"textarea","required":true,"placeholder":"Describe the idea: what it is, what it is for, and any size or colour requirements."},
    {"label":"Electronics / components inside","type":"textarea","required":false,"placeholder":"List any PCB, buttons, battery, display, wiring, sizes/quantities/placement. Write None if purely mechanical."}
  ]'::jsonb
),
(
  'Prototyping — Enclosed Box (ABS)', 'prototyping-enclosed-abs',
  'Fixed-price enclosed box prototype in ABS for heat/impact resistance. A box is 2 parts, lid + back, 1 complete box included, single colour, up to 23x23x23cm.',
  5698, 'prototyping', 'ABS', 999, 'Made to Order', true, true,
  '[
    {"label":"What are you prototyping?","type":"textarea","required":true,"placeholder":"Describe the idea: what it is, what it is for, and any size or colour requirements."},
    {"label":"Electronics / components inside","type":"textarea","required":false,"placeholder":"List any PCB, buttons, battery, display, wiring, sizes/quantities/placement. Write None if purely mechanical."}
  ]'::jsonb
),
(
  'Prototyping — Multi-Part', 'prototyping-multipart',
  'Fixed-price multi-part assembled prototype: lid, back and internal mounts. 1 complete unit, up to 2 colours, functional fit-check, up to 28x28x28cm, 4 design revisions within 31 days.',
  8999, 'prototyping', 'PLA+ or ABS', 999, 'Made to Order', true, true,
  '[
    {"label":"What are you prototyping?","type":"textarea","required":true,"placeholder":"Describe the idea: what it is, what it is for, and any size or colour requirements."},
    {"label":"Material","type":"select","required":true,"options":["PLA+","ABS"],"default_value":"PLA+"},
    {"label":"Electronics / components inside","type":"textarea","required":false,"placeholder":"List any PCB, buttons, battery, display, wiring, sizes/quantities/placement. Write None if purely mechanical."}
  ]'::jsonb
),
(
  'Prototyping — Full Development', 'prototyping-fulldev',
  'Fixed-price full product development prototype: complete enclosure and internal assembly design from your concept. 1 complete unit, 4-6 parts, multi-colour, up to 32x32x32cm, 5 design revisions within 61 days.',
  14999, 'prototyping', 'PLA+ or ABS', 999, 'Made to Order', true, true,
  '[
    {"label":"What are you prototyping?","type":"textarea","required":true,"placeholder":"Describe the idea: what it is, what it is for, and any size or colour requirements."},
    {"label":"Material","type":"select","required":true,"options":["PLA+","ABS"],"default_value":"PLA+"},
    {"label":"Electronics / components inside","type":"textarea","required":false,"placeholder":"List any PCB, buttons, battery, display, wiring, sizes/quantities/placement. Write None if purely mechanical."}
  ]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ── Gallery ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prototyping_gallery (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url   TEXT NOT NULL,
  caption     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prototyping_gallery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prototyping_gallery_public_read" ON prototyping_gallery;
CREATE POLICY "prototyping_gallery_public_read" ON prototyping_gallery
  FOR SELECT TO anon, authenticated USING (is_active = true);
-- No insert/update/delete policy for anon/authenticated: writes only via
-- the backend's service-role key, gated behind requireAuth + requireAdmin
-- (server/routes/admin.js), same pattern as every other admin-managed table.
