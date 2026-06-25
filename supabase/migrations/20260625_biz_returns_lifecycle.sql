-- TriAkar Business OS — Returns & Claims lifecycle (5.3)
-- 2026-06-25. Safe, additive. Run once in Supabase SQL Editor.
-- Expands biz_returns from a flat record into a staged lifecycle with cost
-- snapshots so order COGS / net loss can be recomputed and a claim netted against it.

ALTER TABLE biz_returns ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'initiated';
  -- initiated | returning | received | claim_filed | claim_approved
ALTER TABLE biz_returns ADD COLUMN IF NOT EXISTS received_date         DATE;
ALTER TABLE biz_returns ADD COLUMN IF NOT EXISTS claim_filed_date      DATE;
ALTER TABLE biz_returns ADD COLUMN IF NOT EXISTS claim_filed_amount    NUMERIC(10,2);
ALTER TABLE biz_returns ADD COLUMN IF NOT EXISTS claim_approved_date   DATE;
ALTER TABLE biz_returns ADD COLUMN IF NOT EXISTS claim_approved_amount NUMERIC(10,2);
ALTER TABLE biz_returns ADD COLUMN IF NOT EXISTS return_shipping_cost  NUMERIC(10,2) DEFAULT 0;
ALTER TABLE biz_returns ADD COLUMN IF NOT EXISTS product_cost_adjusted NUMERIC(10,2);  -- override when item is damaged/unusable
-- Snapshot of the order's original COGS components at return time (stable recompute):
ALTER TABLE biz_returns ADD COLUMN IF NOT EXISTS orig_product_cost     NUMERIC(10,2);
ALTER TABLE biz_returns ADD COLUMN IF NOT EXISTS orig_shipping         NUMERIC(10,2);
ALTER TABLE biz_returns ADD COLUMN IF NOT EXISTS orig_packing          NUMERIC(10,2);

-- Net loss recompute (done in the app, stored in amount_lost):
--   recomputed_cogs = orig_shipping + return_shipping_cost + orig_packing
--                     + COALESCE(product_cost_adjusted, orig_product_cost)
--   amount_lost     = recomputed_cogs - COALESCE(claim_approved_amount, 0)
