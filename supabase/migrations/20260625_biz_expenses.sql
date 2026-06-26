-- TriAkar Business OS — Expenses & Purchases (B17)
-- 2026-06-25. Safe, additive. Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS biz_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  category     TEXT,        -- materials | equipment | packaging | marketing | rent | utilities | shipping | other
  vendor       TEXT,
  amount       NUMERIC(10,2) NOT NULL DEFAULT 0,   -- total incl GST
  gst_amount   NUMERIC(10,2) DEFAULT 0,
  payment_mode TEXT,
  invoice_url  TEXT,        -- link to the invoice file (Drive/Dropbox/etc.)
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_expenses_date_idx ON biz_expenses(date DESC);

ALTER TABLE biz_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_expenses" ON biz_expenses;
CREATE POLICY "biz_admin_only_expenses" ON biz_expenses
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');
