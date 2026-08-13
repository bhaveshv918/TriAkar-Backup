-- TriAkar — Money In/Out ledger: order linkage + refund reversal support.
-- 2026-08-14. Safe, additive. Run once in Supabase SQL Editor.
--
-- Money In (biz_income) and Money Out (biz_expenses) entries had no way to reference the
-- storefront order they relate to; that link only existed on invoices. This adds a
-- free-text order_id (same pattern as biz_sale_payments.order_id / biz_invoices.order_id,
-- not a real FK: one order can have several expense/income entries, and orders can be
-- purged from the storefront table while the ledger row must stay as permanent history).
--
-- Also required for the new auto-reversal: when a paid storefront order is permanently
-- deleted from the Recycle Bin, a biz_expenses "refund" row is inserted so the money that
-- was counted as in doesn't just vanish with no trace (see adminRecycleController.js).

ALTER TABLE public.biz_income   ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE public.biz_expenses ADD COLUMN IF NOT EXISTS order_id TEXT;

CREATE INDEX IF NOT EXISTS biz_income_order_id_idx   ON public.biz_income (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS biz_expenses_order_id_idx ON public.biz_expenses (order_id) WHERE order_id IS NOT NULL;

-- biz_expenses.category has no CHECK constraint (free text, see 20260625_biz_expenses.sql),
-- so 'refund' works immediately for the auto-reversal row without a migration change here.

-- A Materials expense can bump a filament spool's total_grams on create
-- (applyExpenseToSpoolStock in admin-biz.html). That bump was never reversed when the
-- expense was later deleted, permanently inflating the spool's stock. Persisting which
-- spool/how many grams were applied lets deleteExpense/deleteLedgerExpense reverse it.
ALTER TABLE public.biz_expenses ADD COLUMN IF NOT EXISTS spool_id INTEGER REFERENCES public.filament_inventory(id) ON DELETE SET NULL;
ALTER TABLE public.biz_expenses ADD COLUMN IF NOT EXISTS spool_grams_applied NUMERIC(10,2);
