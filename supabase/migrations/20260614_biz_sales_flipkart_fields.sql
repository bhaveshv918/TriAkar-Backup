-- TriAkar Business OS — Flipkart import + document fields on biz_sales
-- 2026-06-14
-- Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_sales
  ADD COLUMN IF NOT EXISTS hsn_code         TEXT,   -- HSN code (per line item)
  ADD COLUMN IF NOT EXISTS invoice_no       TEXT,   -- platform (Flipkart) invoice number
  ADD COLUMN IF NOT EXISTS customer_address TEXT,   -- full shipping address (city/pincode stay separate)
  ADD COLUMN IF NOT EXISTS package_size     TEXT;   -- packet dimensions, e.g. 15×15×15 cm
