-- TriAkar Business OS — Machine Sales + Spool Sales in Add Order
-- Adds an item_type to biz_sales so a line item can be a regular Product, a Machine
-- (free-text, no stock link), or a Spool (linked to filament_inventory, marked resold
-- on save via the existing biz_filament_resales/finish_reason machinery).
-- Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_sales
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'product'
    CHECK (item_type IN ('product','machine','spool'));

ALTER TABLE biz_sales
  ADD COLUMN IF NOT EXISTS spool_sale_id INTEGER REFERENCES filament_inventory(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS biz_sales_item_type_idx ON biz_sales (item_type);

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT item_type, count(*) FROM biz_sales GROUP BY 1;
-- ════════════════════════════════════════════════════════════════════════════════
