-- TriAkar — return-window fix + multi-colour item support
--
-- 1. delivered_at: the return window (returnWindowInfo in admin-biz.html) was reading
--    delivery_date, which is actually the PROMISED delivery date entered at Add Sale time —
--    not when the order genuinely arrived. This adds a real arrival timestamp, stamped by
--    updateOrderStatus/bulkMarkStatus/bulkMarkStatusOpen whenever status becomes 'delivered',
--    and the return window now counts from THIS instead.
-- 2. extra_spool_usage: one line item can now use more than one filament spool (dual-colour /
--    AMS multi-material prints) — the primary colour still uses spool_id/grams_used/
--    spool_waste_grams unchanged; additional colours are recorded here as a JSON array
--    [{spool_id, grams, waste}, ...] and deducted the same way on save/delete.
--
-- Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS delivered_at DATE;
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS extra_spool_usage JSONB;
