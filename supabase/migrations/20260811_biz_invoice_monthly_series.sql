-- TriAkar Business OS — invoice series now resets monthly, not just per financial year.
-- Adds a 'period' column (e.g. '2026-27-AUG') that drives the monthly counter and the
-- dup/gap check in admin-biz.html. Safe, additive. Run once in Supabase SQL Editor.
-- biz_invoice_counters needs no schema change: it is already a generic TEXT-keyed
-- counter, so passing a period key like '2026-27-AUG' instead of '2026-27' is enough
-- for the existing biz_next_invoice_number() RPC to reset the sequence each month.

ALTER TABLE biz_invoices ADD COLUMN IF NOT EXISTS period TEXT;
CREATE INDEX IF NOT EXISTS biz_invoices_period_idx ON biz_invoices(period);
