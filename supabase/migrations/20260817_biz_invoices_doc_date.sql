-- TriAkar Business OS — Invoice doc_date + date-vs-series-order guard
-- allocateInvoiceNumber/editInvoiceLog/drag-to-move in the Invoicing tab now
-- enforce that a later invoice number never carries an earlier document date
-- than an earlier one already logged (e.g. #005 cut on 5 Aug means #006 can
-- never be cut on 4 Aug). That check needs each logged invoice's own document
-- date on hand without joining back to biz_sales every time, hence this column,
-- populated going forward at allocation/duplication time. Safe, additive.
-- Run once in Supabase SQL Editor.

ALTER TABLE biz_invoices
  ADD COLUMN IF NOT EXISTS doc_date DATE;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT invoice_number, doc_date, generated_at FROM biz_invoices ORDER BY generated_at DESC LIMIT 20;
-- ════════════════════════════════════════════════════════════════════════════════
