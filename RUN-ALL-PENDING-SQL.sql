-- ════════════════════════════════════════════════════════════════════════════════
-- TriAkar — Round 3, ALL pending SQL in one file, in the correct order.
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- Every statement is idempotent (IF NOT EXISTS / IF EXISTS / ON CONFLICT DO NOTHING),
-- so re-running this file again later is safe and will not duplicate anything.
--
-- Source files (kept separately too, for the record):
--   1. supabase/migrations/20260709_biz_sales_status_extend.sql
--   2. supabase/migrations/20260709_biz_machinery.sql
--   3. supabase/migrations/20260709_biz_invoicing.sql
--   4. supabase/migrations/20260709_biz_sales_customer_id.sql
--   5. supabase/migrations/20260710_site_stories.sql
--   6. backfill-customer-id.sql (one-time data backfill, must run last)
-- ════════════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════
-- 1. Extend biz_sales lifecycle status (delaying, return_initiated,
--    return_picked_up, claim_filed, cancelled_before_dispatch/delivery)
-- ══════════════════════════════════════════════════════════════════════
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.biz_sales'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%IN%'
  LOOP
    EXECUTE 'ALTER TABLE public.biz_sales DROP CONSTRAINT ' || quote_ident(c.conname);
  END LOOP;
END $$;

ALTER TABLE public.biz_sales ADD CONSTRAINT biz_sales_status_check
  CHECK (status IN (
    'pending','order_received','processing','printing','packed',
    'dispatched','delivered','delaying',
    'return_initiated','return_picked_up','returned','claim_filed',
    'completed','delayed',
    'cancelled_before_dispatch','cancelled_before_delivery','cancelled',
    'claimed'
  ));


-- ══════════════════════════════════════════════════════════════════════
-- 2. Machinery (printers/equipment) + print attempts
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS biz_printers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  type              TEXT DEFAULT 'FDM Printer',
  build_volume      TEXT,
  build_plate       TEXT,
  multicolor        BOOLEAN DEFAULT false,
  other_capability  TEXT,
  purchase_value    NUMERIC(10,2),
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


-- ══════════════════════════════════════════════════════════════════════
-- 3. Real sequential invoice numbering + Invoicing log + GST Portal + Expenses fields
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS biz_invoice_counters (
  financial_year TEXT PRIMARY KEY,
  next_seq       INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS biz_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT NOT NULL UNIQUE,
  financial_year  TEXT NOT NULL,
  sale_id         UUID REFERENCES biz_sales(id) ON DELETE SET NULL,
  order_id        TEXT,
  doc_kind        TEXT NOT NULL DEFAULT 'invoice',
  generated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_invoices_sale_idx ON biz_invoices(sale_id);
CREATE INDEX IF NOT EXISTS biz_invoices_order_idx ON biz_invoices(order_id);

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

ALTER TABLE biz_expenses ADD COLUMN IF NOT EXISTS recurring BOOLEAN DEFAULT false;
ALTER TABLE biz_expenses ADD COLUMN IF NOT EXISTS source TEXT;

CREATE TABLE IF NOT EXISTS biz_gst_filings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_type  TEXT NOT NULL CHECK (return_type IN ('gstr1','gstr3b')),
  period       TEXT NOT NULL,
  file_url     TEXT,
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

INSERT INTO storage.buckets (id, name, public)
  VALUES ('biz-gst', 'biz-gst', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "biz_gst_admin_all" ON storage.objects;
CREATE POLICY "biz_gst_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'biz-gst' AND auth.email() = 'bhaveshv918@gmail.com')
  WITH CHECK (bucket_id = 'biz-gst' AND auth.email() = 'bhaveshv918@gmail.com');


-- ══════════════════════════════════════════════════════════════════════
-- 4. Real customer_id link on biz_sales
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES biz_customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS biz_sales_customer_id_idx ON biz_sales(customer_id);


-- ══════════════════════════════════════════════════════════════════════
-- 5. Stories CMS (site_stories) + seed the 12 existing hardcoded stories
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS site_stories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year        INT NOT NULL,
  month       INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  sort_order  INT NOT NULL DEFAULT 0,
  tag         TEXT NOT NULL DEFAULT 'Other',
  title       TEXT NOT NULL,
  excerpt     TEXT NOT NULL,
  full_text   TEXT NOT NULL,
  image_url   TEXT,
  published   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_stories_year_month_idx ON site_stories(year, month, sort_order);

ALTER TABLE site_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_stories_admin_only" ON site_stories;
CREATE POLICY "site_stories_admin_only" ON site_stories
  FOR ALL TO authenticated
  USING (auth.email()='bhaveshv918@gmail.com')
  WITH CHECK (auth.email()='bhaveshv918@gmail.com');

INSERT INTO site_stories (year, month, sort_order, tag, title, excerpt, full_text)
SELECT * FROM (VALUES
  (2026, 1,  1, 'Replacement Part', 'A 23-year-old Maruti bracket, found nowhere in India', 'Rajesh from Pune had searched every spare parts shop for 8 months.', 'Rajesh from Pune had searched every spare parts shop for 8 months. One photo sent on WhatsApp. We reverse-engineered it and delivered in 4 days.'),
  (2026, 2,  1, 'Gifting', '200 ring holders for a Jaipur wedding, all with custom initials', 'The bride wanted something personal for every guest.', 'The bride wanted something personal for every guest. Custom monogram on every piece. Delivered 10 days before the ceremony.'),
  (2026, 3,  1, 'Corporate', '80 nameplates for a Bengaluru tech company office launch', 'Exact font match. Exact color. Delivered in 10-15 business days.', 'Exact font match. Exact color. Delivered in 10-15 business days. Better than anything they found on Amazon.'),
  (2026, 4,  1, 'Replacement Part', 'Mixer grinder knob, spare not sold separately anywhere', 'Neha''s mixer stopped working because one knob snapped.', 'Neha''s mixer stopped working because one knob snapped. Matched it in 48-72 hours.'),
  (2026, 5,  1, 'Gifting', '40 personalised keychains for a 40th birthday, every message different', 'She wanted every one of the 40 people to receive something written just for them.', 'She was turning 40 and wanted to thank the 40 most important people in her life, not with the same gift, but with a message written just for each person. We made 40 personalised letter keychains. Every single one carried a completely different message. No two were the same.'),
  (2026, 6,  1, 'Gifting', 'A custom nameplate with Devanagari script for a teacher''s farewell', 'Students wanted something no shop could make.', 'Students wanted something no shop could make. Their teacher''s name in Hindi, with the school emblem. Done in 2 days.'),
  (2026, 7,  1, 'Replacement Part', 'Geometric vase set designed from a Pinterest screenshot', 'No measurements. Just a photo.', 'No measurements. Just a photo. We modelled it, printed it in 3 colors.'),
  (2026, 8,  1, 'Gifting', '150 Diwali gift boxes with custom Shubh Diwali engravings', 'A housing society ordered for all their residents.', 'A housing society ordered for all their residents. Ready 3 days before Diwali.'),
  (2026, 9,  1, 'Gifting', 'Custom alphabet blocks for a child with a rare name', 'No shop stocked blocks with her name.', 'No shop stocked blocks with her name. Printed every letter in her favorite color within 48-72 hours.'),
  (2026, 10, 1, 'Corporate', 'Branded cable clips for a coworking space, 300 pieces', 'Every desk had their logo.', 'Every desk had their logo. Delivered in 7 days.'),
  (2026, 11, 1, 'Replacement Part', 'Refrigerator shelf bracket for a 9-year-old appliance, no spare sold', 'Measured from photos, matched the plastic color.', 'Measured from photos, matched the plastic color, delivered in 3 days.'),
  (2026, 12, 1, 'Gifting', '50 personalized Christmas ornaments for a school', 'Each child''s name on their own ornament.', 'Each child''s name on their own ornament. Made and delivered in 4 days.')
) AS seed(year, month, sort_order, tag, title, excerpt, full_text)
WHERE NOT EXISTS (SELECT 1 FROM site_stories);


-- ══════════════════════════════════════════════════════════════════════
-- 6. Backfill customer_id on historical biz_sales rows (exact match only:
--    normalized phone first, then exact case-insensitive name)
-- ══════════════════════════════════════════════════════════════════════
WITH missing AS (
  SELECT trim(s.customer_name) AS name,
         NULLIF(right(regexp_replace(coalesce(s.customer_phone, ''), '\D', '', 'g'), 10), '') AS phone
  FROM biz_sales s
  WHERE s.customer_id IS NULL
    AND s.customer_name IS NOT NULL
    AND trim(s.customer_name) <> ''
  GROUP BY 1, 2
)
INSERT INTO biz_customers (name, phone)
SELECT m.name, m.phone
FROM missing m
WHERE NOT EXISTS (
  SELECT 1 FROM biz_customers c
  WHERE (m.phone IS NOT NULL AND right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10) = m.phone)
     OR lower(trim(c.name)) = lower(m.name)
);

UPDATE biz_sales s
SET customer_id = c.id
FROM biz_customers c
WHERE s.customer_id IS NULL
  AND s.customer_name IS NOT NULL
  AND right(regexp_replace(coalesce(s.customer_phone, ''), '\D', '', 'g'), 10) <> ''
  AND right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10)
    = right(regexp_replace(coalesce(s.customer_phone, ''), '\D', '', 'g'), 10);

UPDATE biz_sales s
SET customer_id = c.id
FROM biz_customers c
WHERE s.customer_id IS NULL
  AND s.customer_name IS NOT NULL
  AND lower(trim(c.name)) = lower(trim(s.customer_name));

-- ── VERIFY (run these separately after) ─────────────────────────────────────────
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.biz_sales'::regclass AND contype='c' AND conname='biz_sales_status_check';
-- SELECT count(*) FROM biz_sales WHERE customer_id IS NULL AND customer_name IS NOT NULL AND trim(customer_name) <> '';
-- SELECT count(*) FROM site_stories;
-- ════════════════════════════════════════════════════════════════════════════════
