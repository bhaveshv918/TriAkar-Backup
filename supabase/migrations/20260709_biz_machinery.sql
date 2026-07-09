-- TriAkar Business OS — Round 3 Batch 3: Machinery (printers/equipment) + print attempts
-- Safe, additive. Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS biz_printers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  type              TEXT DEFAULT 'FDM Printer',
  build_volume      TEXT,
  build_plate       TEXT,
  multicolor        BOOLEAN DEFAULT false,   -- AMS / multi-material capable
  other_capability  TEXT,                     -- freeform: enclosed chamber, high-temp hotend, etc.
  purchase_value    NUMERIC(10,2),            -- feeds the Balance Sheet as an asset
  purchase_date     DATE,
  active            BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS biz_print_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    TEXT,
  sale_id     UUID REFERENCES biz_sales(id) ON DELETE SET NULL,
  printer_id  UUID REFERENCES biz_printers(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL DEFAULT 'other'
              CHECK (reason IN ('reprint_guarantee','power_cut','filament_runout','quality_issue','other')),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_print_attempts_printer_idx ON biz_print_attempts(printer_id);
CREATE INDEX IF NOT EXISTS biz_print_attempts_order_idx ON biz_print_attempts(order_id);

ALTER TABLE biz_printers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_printers" ON biz_printers;
CREATE POLICY "biz_admin_only_printers" ON biz_printers
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');

ALTER TABLE biz_print_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_print_attempts" ON biz_print_attempts;
CREATE POLICY "biz_admin_only_print_attempts" ON biz_print_attempts
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');
