-- TriAkar Business OS — extra fields on biz_sales
-- 2026-06-13

ALTER TABLE biz_sales
  ADD COLUMN IF NOT EXISTS delivery_date    DATE,
  ADD COLUMN IF NOT EXISTS dispatch_date    DATE,
  ADD COLUMN IF NOT EXISTS tracking_number  TEXT,
  ADD COLUMN IF NOT EXISTS courier_partner  TEXT,
  ADD COLUMN IF NOT EXISTS size             TEXT,
  ADD COLUMN IF NOT EXISTS color            TEXT,
  ADD COLUMN IF NOT EXISTS variant          TEXT,
  ADD COLUMN IF NOT EXISTS weight_grams     INTEGER,
  ADD COLUMN IF NOT EXISTS discount_amount  NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_phone   TEXT;
