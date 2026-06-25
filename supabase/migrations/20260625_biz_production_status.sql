-- TriAkar Business OS — per-order studio production stage (B15)
-- 2026-06-25. Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS production_status TEXT DEFAULT 'queued';
-- queued | printing | post_processing | qc | packed
