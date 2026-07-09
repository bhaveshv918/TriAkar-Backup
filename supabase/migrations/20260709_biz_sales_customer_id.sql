-- TriAkar Business OS — Round 3 Batch 5: real customer_id link on biz_sales
--
-- Add Sale's customer field was pure denormalized text (customer_name), so there was no
-- way to actually "select" a customer as an entity (bulk actions, reliable merge/edit).
-- This adds an FK column; admin-biz.html's insertSalesResilient() now resolves-or-creates
-- a biz_customers row and attaches its id on every new sale. Existing historical rows are
-- left with customer_id = NULL (their text name is unaffected) — this is additive, no
-- backfill attempted since name-matching old free-text data reliably isn't safe to automate.
-- Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES biz_customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS biz_sales_customer_id_idx ON biz_sales(customer_id);
