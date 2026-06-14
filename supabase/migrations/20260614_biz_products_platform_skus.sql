-- TriAkar Business OS — link Amazon/Flipkart listings to catalog products
-- 2026-06-14. Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_products
  ADD COLUMN IF NOT EXISTS platform_skus TEXT;   -- comma-separated platform SKUs that map to this product
