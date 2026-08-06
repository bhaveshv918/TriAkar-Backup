-- TriAkar — biz_sales.remarks column, was never actually migrated
--
-- admin-biz.html has written/read `remarks` (a free-text per-item note, shown
-- italic on invoices) on biz_sales rows for a while now (buildSaleRowsWithIds,
-- printInvoice), and _extractBadColumn's comment even references "adding
-- biz_sales.remarks" — but no migration ever actually added the column. New
-- orders silently succeeded because insertRowsResilient() strips any column
-- Postgres/PostgREST rejects and retries, so `remarks` was quietly dropped on
-- every INSERT. Editing an EXISTING order uses a plain (non-resilient) UPDATE,
-- which has no such retry, so it hard-fails with "Could not find the 'remarks'
-- column of 'biz_sales' in the schema cache" the moment Save is clicked.
--
-- Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS remarks TEXT;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name='biz_sales' AND column_name='remarks';
-- ════════════════════════════════════════════════════════════════════════════════
