-- TriAkar Business OS, Phase 10 Group 3 (H): rack/shelf inventory tracking.
--
-- Finished, ready-to-sell product stock physically sitting on a studio shelf.
-- Deliberately separate from filament_inventory's gram-based stock value, that
-- table already tracks raw material, this tracks finished goods, a category the
-- Balance Sheet didn't have an asset line for at all until now.
--
-- Safe, additive. Run once in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS biz_rack_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID REFERENCES biz_products(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,
  qty           INT NOT NULL DEFAULT 1,
  cost_price    NUMERIC(10,2) NOT NULL DEFAULT 0,   -- per unit, matches Filament Stock Value's cost-basis convention
  rack_location TEXT,                                -- e.g. "Shelf A2", optional
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_rack_items_product_idx ON biz_rack_items (product_id);

ALTER TABLE biz_rack_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_rack_items" ON biz_rack_items;
CREATE POLICY "biz_admin_only_rack_items" ON biz_rack_items
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com');

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- INSERT INTO biz_rack_items(product_name,qty,cost_price,rack_location) VALUES ('Test Item',3,150,'Shelf A1');
-- SELECT * FROM biz_rack_items;
-- ════════════════════════════════════════════════════════════════════════════════
