-- TriAkar Business OS — Reference Document on orders
-- When an order is created from the Quotations panel ("Add to Order" / "Make
-- Invoice"), the source quotation's number should carry through onto the order
-- and print on its Invoice/Order Record next to the Date, so the document shows
-- what it was converted from. An order started fresh (not from a quotation) just
-- leaves this blank. Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_sales
  ADD COLUMN IF NOT EXISTS reference_document TEXT;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT order_id, reference_document FROM biz_sales WHERE reference_document IS NOT NULL ORDER BY order_date DESC LIMIT 20;
-- ════════════════════════════════════════════════════════════════════════════════
