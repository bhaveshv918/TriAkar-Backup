-- TriAkar Business OS — Round Off on quotations
-- Add Order already had a Round Off field (20260811_biz_sales_round_off.sql), Quotations
-- never got one at all: the field lived inside the Order Charges card, which is hidden
-- entirely in quotation mode, and biz_quotations had no column to save it into even if it
-- had been visible. Same convention as biz_sales' round_off. Run once in Supabase SQL Editor.

ALTER TABLE biz_quotations
  ADD COLUMN IF NOT EXISTS round_off NUMERIC(6,2) NOT NULL DEFAULT 0;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT quotation_number, round_off FROM biz_quotations WHERE round_off <> 0 ORDER BY quotation_date DESC LIMIT 20;
-- ════════════════════════════════════════════════════════════════════════════════
