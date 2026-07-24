-- TriAkar Business OS: per-gram pricing mode for Add Order items.
--
-- Adds one column so a line item can be priced by weight (rate = ₹/gram,
-- amount = qty × grams × rate) instead of by piece (rate = ₹/pc,
-- amount = qty × rate). Existing rows are unaffected, they default to
-- 'piece' which is exactly how they already behave today.
--
-- Multi-part items (a piece assembled from several printed parts, each
-- with its own spool/grams/waste) reuse the existing extra_spool_usage
-- jsonb column, just adding a "label" key per entry (e.g. "Lid", "Base").
-- No schema change needed for that since jsonb already accepts new keys.
--
-- Safe, additive. Run once in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE biz_sales
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'piece'
    CHECK (pricing_mode IN ('piece','gram'));
