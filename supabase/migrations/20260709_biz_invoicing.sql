-- TriAkar Business OS — Round 3 Batch 4: real sequential invoice numbering + Invoicing log
--
-- Previously invoice numbers came from nextDocNumber() in admin-biz.html, which kept its
-- counter in localStorage — per-device, resets if storage is cleared, and two people/devices
-- printing invoices at the same time would collide or diverge. This replaces it with a
-- DB-backed, per-financial-year atomic counter, plus a log table so every invoice ever
-- generated can be looked up and relinked to its order (the new Invoicing tab).
-- Safe, additive. Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS biz_invoice_counters (
  financial_year TEXT PRIMARY KEY,   -- e.g. '2026-27'
  next_seq       INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS biz_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT NOT NULL UNIQUE,
  financial_year  TEXT NOT NULL,
  sale_id         UUID REFERENCES biz_sales(id) ON DELETE SET NULL,
  order_id        TEXT,
  doc_kind        TEXT NOT NULL DEFAULT 'invoice',  -- 'invoice' (customer-facing) or 'record' (internal)
  generated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_invoices_sale_idx ON biz_invoices(sale_id);
CREATE INDEX IF NOT EXISTS biz_invoices_order_idx ON biz_invoices(order_id);

-- Atomic "give me the next number for this financial year" — UPSERT+RETURNING avoids the
-- read-then-write race two simultaneous invoice prints would otherwise hit.
CREATE OR REPLACE FUNCTION biz_next_invoice_number(p_fy TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_seq INT;
BEGIN
  INSERT INTO biz_invoice_counters(financial_year, next_seq) VALUES (p_fy, 1)
  ON CONFLICT (financial_year) DO UPDATE SET next_seq = biz_invoice_counters.next_seq + 1
  RETURNING next_seq INTO v_seq;
  RETURN v_seq;
END;
$$;
GRANT EXECUTE ON FUNCTION biz_next_invoice_number(TEXT) TO authenticated;

ALTER TABLE biz_invoice_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_invoice_counters" ON biz_invoice_counters;
CREATE POLICY "biz_admin_only_invoice_counters" ON biz_invoice_counters
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');

ALTER TABLE biz_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_invoices" ON biz_invoices;
CREATE POLICY "biz_admin_only_invoices" ON biz_invoices
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');

-- Expenses (Batch 4): staff-salary category, recurring flag, money-out source.
ALTER TABLE biz_expenses ADD COLUMN IF NOT EXISTS recurring BOOLEAN DEFAULT false;
ALTER TABLE biz_expenses ADD COLUMN IF NOT EXISTS source TEXT;

-- GST Portal (Batch 4): uploaded GSTR1/GSTR3B report files, private storage path only.
CREATE TABLE IF NOT EXISTS biz_gst_filings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_type  TEXT NOT NULL CHECK (return_type IN ('gstr1','gstr3b')),
  period       TEXT NOT NULL,     -- 'YYYY-MM'
  file_url     TEXT,              -- path in the private biz-gst storage bucket
  filed_date   DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE biz_gst_filings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_gst_filings" ON biz_gst_filings;
CREATE POLICY "biz_admin_only_gst_filings" ON biz_gst_filings
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');

-- Create the private storage bucket for GST filing uploads (mirrors the biz-invoices bucket).
INSERT INTO storage.buckets (id, name, public)
  VALUES ('biz-gst', 'biz-gst', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "biz_gst_admin_all" ON storage.objects;
CREATE POLICY "biz_gst_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'biz-gst' AND auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK (bucket_id = 'biz-gst' AND auth.email() = 'bhaveshv918@gmail.com');
