-- GST Filing Automation: GSTR-1 reconciliation engine.
--
-- Calculates GSTR-1 tables (B2B, B2CS, HSN, Documents Issued) from monthly Amazon MTR
-- CSVs + Flipkart GSTR-1/8 report, distinct from `biz_gst_filings` (which archives files
-- for returns already filed by hand; that table is untouched by this feature).
-- Safe, additive. Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS biz_gst_calc_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period        TEXT NOT NULL UNIQUE,     -- 'YYYY-MM'
  seller_gstin  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','exported','filed')),
  totals        JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {taxable,cgst,sgst,igst,total,docCount}
  source_files  JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {amazonB2b:{name,size}, amazonB2c:{...}, flipkart:{...}} audit trail only, files not stored
  filed_date    DATE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS biz_gst_calc_line_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   UUID NOT NULL REFERENCES biz_gst_calc_periods(id) ON DELETE CASCADE,
  table_type  TEXT NOT NULL CHECK (table_type IN ('b2b','b2cs','hsn','docs')),
  state       TEXT,           -- b2b / b2cs
  gstin       TEXT,           -- b2b
  invoice_no  TEXT,           -- b2b
  invoice_date DATE,          -- b2b
  rate        NUMERIC,        -- b2b / b2cs / hsn
  taxable     NUMERIC DEFAULT 0,
  cgst        NUMERIC DEFAULT 0,
  sgst        NUMERIC DEFAULT 0,
  igst        NUMERIC DEFAULT 0,
  extra       JSONB DEFAULT '{}'::jsonb,   -- table-specific fields (HSN code/qty/uqc, doc series from/to/cancelled count, channel)
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_gst_calc_line_items_period_idx ON biz_gst_calc_line_items(period_id);
CREATE INDEX IF NOT EXISTS biz_gst_calc_line_items_table_idx ON biz_gst_calc_line_items(period_id, table_type);

CREATE TABLE IF NOT EXISTS biz_gst_calc_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   UUID NOT NULL REFERENCES biz_gst_calc_periods(id) ON DELETE CASCADE,
  severity    TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('blocker','warning')),
  code        TEXT NOT NULL,
  message     TEXT NOT NULL,
  context     JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_gst_calc_flags_period_idx ON biz_gst_calc_flags(period_id);

ALTER TABLE biz_gst_calc_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_gst_calc_periods" ON biz_gst_calc_periods;
CREATE POLICY "biz_admin_only_gst_calc_periods" ON biz_gst_calc_periods
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');

ALTER TABLE biz_gst_calc_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_gst_calc_line_items" ON biz_gst_calc_line_items;
CREATE POLICY "biz_admin_only_gst_calc_line_items" ON biz_gst_calc_line_items
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');

ALTER TABLE biz_gst_calc_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_gst_calc_flags" ON biz_gst_calc_flags;
CREATE POLICY "biz_admin_only_gst_calc_flags" ON biz_gst_calc_flags
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');
