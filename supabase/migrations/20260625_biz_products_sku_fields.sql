-- TriAkar Business OS — product fields for auto-SKU (5.1) + filament (5.5)
-- 2026-06-25. Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_products ADD COLUMN IF NOT EXISTS color          TEXT;             -- e.g. Black (feeds SKU COLOR segment)
ALTER TABLE biz_products ADD COLUMN IF NOT EXISTS material       TEXT DEFAULT 'PLA+'; -- feeds SKU MATERIAL segment
ALTER TABLE biz_products ADD COLUMN IF NOT EXISTS grams_per_unit NUMERIC(10,2);     -- default filament grams/unit (auto-fills Add Sale line, 5.5)
