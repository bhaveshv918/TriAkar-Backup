-- TriAkar Business OS — Allow temporary duplicate invoice numbers
-- biz_invoices.invoice_number had a hard UNIQUE constraint, which meant the
-- bypassable "already used, use it anyway?" warning in editInvoiceLog/
-- allocateInvoiceNumber could never actually go through for a genuine
-- duplicate, the DB always rejected it. Sometimes the same number is needed
-- on two rows for a short window (one gets deleted or renumbered right
-- after), so the constraint is dropped, the warning dialog stays as the
-- only guardrail. Safe, removes a constraint only, no data changes.
-- Run once in Supabase SQL Editor.

ALTER TABLE biz_invoices DROP CONSTRAINT IF EXISTS biz_invoices_invoice_number_key;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT invoice_number, count(*) FROM biz_invoices GROUP BY invoice_number HAVING count(*)>1;
-- ════════════════════════════════════════════════════════════════════════════════
