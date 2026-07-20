-- TriAkar Business OS, Phase 10 Group 1: universal Record ID, Quotation module,
-- and the Add Order payment sub-system.
--
-- Four independent pieces, all additive:
--   1. biz_record_ids: a shared uniqueness registry + gen_record_id() RPC, format
--      TRI-ORDREC-<MM><FYstartYY><FYendYY>-<5 random letters>, retry-on-collision.
--      Applies to every entry type going forward (orders and quotations first).
--   2. biz_sales.record_id: the column an order's Record ID lives in.
--   3. biz_quotations + biz_quotation_counters + biz_next_quotation_number(): a
--      fully separate table and its own FY-based sequential number series
--      (QT/<fy>/<seq>), independent of both Order ID and Invoice Number.
--   4. biz_sale_payments: one row per payment installment against an order,
--      keyed on the free-text order_id (an order is N biz_sales rows sharing one
--      order_id, so payments key on that string, not a row's own UUID, matching
--      how biz_invoices.order_id already does this).
--
-- Safe, additive. Run once in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Universal Record ID registry ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_record_ids (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   TEXT UNIQUE NOT NULL,
  entity_type TEXT NOT NULL,        -- 'order', 'quotation', more added later
  entity_ref  TEXT,                 -- caller's own key, e.g. order_id / quotation id
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_record_ids_entity_idx ON biz_record_ids (entity_type, entity_ref);

CREATE OR REPLACE FUNCTION gen_record_id(p_entity_type TEXT, p_entity_ref TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix   TEXT;
  v_letters  TEXT;
  v_candidate TEXT;
  v_chars    TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  v_fy_start INT;
  i          INT;
  attempt    INT;
BEGIN
  -- FY starts in April; MM is the current calendar month, not the FY month.
  v_fy_start := CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
                      THEN EXTRACT(YEAR FROM CURRENT_DATE)::INT
                      ELSE EXTRACT(YEAR FROM CURRENT_DATE)::INT - 1 END;
  v_prefix := 'TRI-ORDREC-'
    || LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0')
    || LPAD((v_fy_start % 100)::TEXT, 2, '0')
    || LPAD(((v_fy_start + 1) % 100)::TEXT, 2, '0')
    || '-';

  FOR attempt IN 1..10 LOOP
    v_letters := '';
    FOR i IN 1..5 LOOP
      v_letters := v_letters || substr(v_chars, floor(random() * length(v_chars) + 1)::INT, 1);
    END LOOP;
    v_candidate := v_prefix || v_letters;
    BEGIN
      INSERT INTO biz_record_ids (record_id, entity_type, entity_ref)
      VALUES (v_candidate, p_entity_type, p_entity_ref);
      RETURN v_candidate;
    EXCEPTION WHEN unique_violation THEN
      -- collision, loop and try another 5-letter suffix
      CONTINUE;
    END;
  END LOOP;
  RAISE EXCEPTION 'gen_record_id: could not find a unique record_id after 10 attempts (prefix %)', v_prefix;
END;
$$;
GRANT EXECUTE ON FUNCTION gen_record_id(TEXT, TEXT) TO authenticated;

ALTER TABLE biz_record_ids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_record_ids" ON biz_record_ids;
CREATE POLICY "biz_admin_only_record_ids" ON biz_record_ids
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com');

-- 2. Record ID column on orders ───────────────────────────────────────────────────
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS record_id TEXT;

-- 3. Quotation module ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_quotations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id         TEXT,
  quotation_number  TEXT,
  financial_year    TEXT,
  status            TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','sent','accepted','declined','expired')),
  customer_name     TEXT,
  customer_phone    TEXT,
  customer_address  TEXT,
  customer_city     TEXT,
  customer_state    TEXT,
  customer_pincode  TEXT,
  customer_gstin    TEXT,
  items             JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal          NUMERIC(10,2) DEFAULT 0,
  gst_amount        NUMERIC(10,2) DEFAULT 0,
  total             NUMERIC(10,2) DEFAULT 0,
  validity_date     DATE,
  terms_notes       TEXT,
  show_qr           BOOLEAN NOT NULL DEFAULT true,
  converted_order_id TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_quotations_status_idx ON biz_quotations (status);
CREATE INDEX IF NOT EXISTS biz_quotations_created_idx ON biz_quotations (created_at DESC);

CREATE TABLE IF NOT EXISTS biz_quotation_counters (
  financial_year TEXT PRIMARY KEY,
  next_seq       INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION biz_next_quotation_number(p_fy TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_seq INT;
BEGIN
  INSERT INTO biz_quotation_counters(financial_year, next_seq) VALUES (p_fy, 1)
  ON CONFLICT (financial_year) DO UPDATE SET next_seq = biz_quotation_counters.next_seq + 1
  RETURNING next_seq INTO v_seq;
  RETURN v_seq;
END;
$$;
GRANT EXECUTE ON FUNCTION biz_next_quotation_number(TEXT) TO authenticated;

ALTER TABLE biz_quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_quotations" ON biz_quotations;
CREATE POLICY "biz_admin_only_quotations" ON biz_quotations
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com');

ALTER TABLE biz_quotation_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_quotation_counters" ON biz_quotation_counters;
CREATE POLICY "biz_admin_only_quotation_counters" ON biz_quotation_counters
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com');

-- 4. Payment installments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_sale_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      TEXT NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  source        TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_sale_payments_order_idx ON biz_sale_payments (order_id);

ALTER TABLE biz_sale_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_sale_payments" ON biz_sale_payments;
CREATE POLICY "biz_admin_only_sale_payments" ON biz_sale_payments
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com');

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT gen_record_id('order','TEST-1');  -- should return TRI-ORDREC-MMYYYY-XXXXX
-- SELECT gen_record_id('order','TEST-2');  -- should return a DIFFERENT 5-letter suffix
-- SELECT biz_next_quotation_number('2026-27');  -- should return 1, then 2 on a second call
-- SELECT column_name FROM information_schema.columns WHERE table_name='biz_sales' AND column_name='record_id';
-- INSERT INTO biz_sale_payments(order_id,amount,source) VALUES ('TEST-ORDER',500,'upi');
-- SELECT * FROM biz_sale_payments WHERE order_id='TEST-ORDER';
-- ════════════════════════════════════════════════════════════════════════════════
