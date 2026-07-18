-- TriAkar — GST-sourced bulk import into Purchases/Expenses (Business OS accounting).
--
-- Per GST-AUTOMATION-SPEC.md "Downstream: feeding transactions into Business OS accounting":
-- the GSTR-2B B2B sheet (supplier-filed inward-supply data, GSTIN-level, invoice-level) is the
-- source for backfilling biz_purchases/biz_expenses so the balance sheet doesn't need the same
-- transactions re-entered by hand. This table exists purely for duplicate detection — re-running
-- the import for a month already imported must not double-insert or double-count on the balance
-- sheet (confirmed risk, see spec + [[gst-reconciliation-verification-discipline]]).
--
-- One row per GSTR-2B B2B line item that was reviewed and committed (or explicitly excluded,
-- e.g. Amazon/Flipkart's own fee entities, which are already netted into the payout amount
-- logged in biz_income per the user's confirmed settlement model — importing them again as a
-- separate expense would double-subtract them from the balance sheet).
--
-- Idempotent — safe to run multiple times.
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.biz_gst_import_lines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period         TEXT NOT NULL,             -- 'YYYY-MM', the GSTR-2B period this line came from
  supplier_gstin TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  vendor_name    TEXT,
  invoice_date   DATE,
  taxable        NUMERIC(10,2) DEFAULT 0,
  tax_total      NUMERIC(10,2) DEFAULT 0,
  action         TEXT NOT NULL DEFAULT 'imported'
                 CHECK (action IN ('imported','excluded')),
  target_table   TEXT CHECK (target_table IN ('biz_purchases','biz_expenses')),
  target_id      UUID,       -- the row created in biz_purchases/biz_expenses, null if excluded
  category       TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
-- The real duplicate-detection key: a given supplier invoice can only be committed once, ever,
-- regardless of which month's GSTR-2B pull it was re-derived from (a supplier's credit note can
-- shift which period an invoice surfaces in on a later pull).
CREATE UNIQUE INDEX IF NOT EXISTS biz_gst_import_lines_dedup_idx
  ON public.biz_gst_import_lines (supplier_gstin, invoice_number);
CREATE INDEX IF NOT EXISTS biz_gst_import_lines_period_idx ON public.biz_gst_import_lines (period);

ALTER TABLE public.biz_gst_import_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_gst_import_lines" ON public.biz_gst_import_lines;
CREATE POLICY "biz_admin_only_gst_import_lines" ON public.biz_gst_import_lines
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com');

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- INSERT INTO biz_gst_import_lines(period,supplier_gstin,invoice_number,action)
--   VALUES('2026-06','07AAGCR8772D1Z4','CRN1043548877','imported'); -- should succeed
-- INSERT INTO biz_gst_import_lines(period,supplier_gstin,invoice_number,action)
--   VALUES('2026-06','07AAGCR8772D1Z4','CRN1043548877','imported'); -- should FAIL (unique violation)
-- ════════════════════════════════════════════════════════════════════════════════
