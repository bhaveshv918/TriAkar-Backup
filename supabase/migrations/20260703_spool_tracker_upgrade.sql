-- TriAkar Business OS — Spool Tracker v2: gram-based tracking + Sales/COGS integration
-- 2026-07-03. Run BEFORE 20260703_drop_filament_rolls.sql.

-- Extend filament_inventory with gram-based tracking, replacing the qty_remaining fraction
ALTER TABLE filament_inventory
  ADD COLUMN total_grams   NUMERIC(10,2) NOT NULL DEFAULT 1000,
  ADD COLUMN grams_used    NUMERIC(10,2) NOT NULL DEFAULT 0,   -- grams that went into products
  ADD COLUMN waste_grams   NUMERIC(10,2) NOT NULL DEFAULT 0,   -- grams wasted (failed prints, purge, etc.)
  ADD COLUMN cost_per_gram NUMERIC(6,3),                       -- Rs. per gram, feeds COGS
  ADD COLUMN opened_date   DATE,
  ADD COLUMN finished_date DATE;

-- Backfill from the existing physical-audit data (size_kg=1 -> 1000g spools;
-- qty_remaining fraction -> grams_used approximation; no waste history exists pre-migration)
UPDATE filament_inventory SET
  total_grams   = COALESCE(size_kg,1)*1000,
  grams_used    = ROUND((1 - COALESCE(qty_remaining,1)) * COALESCE(size_kg,1)*1000),
  cost_per_gram = ROUND(price / NULLIF(COALESCE(size_kg,1)*1000, 0), 3),
  opened_date   = created_at::date,
  finished_date = CASE WHEN status='Finsh' THEN created_at::date ELSE NULL END;

ALTER TABLE filament_inventory DROP COLUMN qty_remaining;

-- Sales: swap the old UUID roll link for an integer spool link + a waste column
ALTER TABLE biz_sales
  ADD COLUMN IF NOT EXISTS spool_id INTEGER REFERENCES filament_inventory(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS spool_waste_grams NUMERIC(10,2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_biz_sales_spool ON biz_sales(spool_id);

ALTER TABLE biz_sales DROP COLUMN IF EXISTS filament_roll_id;
ALTER TABLE biz_purchases DROP COLUMN IF EXISTS linked_roll_id;
