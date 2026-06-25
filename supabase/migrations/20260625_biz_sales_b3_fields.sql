-- TriAkar Business OS — Quick Add Sale (B3) new fields + status lifecycle
-- 2026-06-25. Safe, additive. Run once in Supabase SQL Editor.

-- ── New per-sale fields ─────────────────────────────────────────────────
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS grams_used        NUMERIC(10,2);  -- filament grams for this line (links 5.5)
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS lead_source       TEXT;           -- studio_walkin / whatsapp / google / instagram / referral / other
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS fulfillment_type  TEXT;           -- 'delivery' | 'pickup'
ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS fulfillment_detail TEXT;          -- 'self' | 'porter' | free text (pickup only)

-- ── Order status lifecycle (B3) ─────────────────────────────────────────
-- Orders now move Pending -> Processing -> Dispatched -> Delivered -> Completed,
-- with Returned / Cancelled as branch states (claimed kept for returns/claims).
-- The original CHECK only allowed completed/returned/cancelled/claimed.
ALTER TABLE biz_sales DROP CONSTRAINT IF EXISTS biz_sales_status_check;
ALTER TABLE biz_sales ADD CONSTRAINT biz_sales_status_check
  CHECK (status IN ('pending','processing','dispatched','delivered',
                    'completed','returned','cancelled','claimed'));

-- Note: DEFAULT stays 'completed' so CSV/marketplace imports (already-finished
-- orders) are unaffected. The Quick Add Sale form sets 'pending' explicitly.
