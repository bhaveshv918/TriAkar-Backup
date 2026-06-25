-- TriAkar Business OS — marketplace settlement ingestion (5.4)
-- 2026-06-25. Safe, additive. Run once in Supabase SQL Editor.
-- Stores the actual amount the marketplace paid out + fees deducted, per order,
-- matched from an uploaded Flipkart/Amazon settlement report by order ID.

ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS settlement_amount NUMERIC(10,2);  -- actual payout to seller
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS settlement_fees   NUMERIC(10,2);  -- fees/charges deducted
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS settlement_date   DATE;
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS settlement_source TEXT;           -- amazon | flipkart | marketplace
