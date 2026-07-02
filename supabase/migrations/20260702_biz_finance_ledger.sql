-- TriAkar — Round 3 §2.1/§2.3/§2.4/§2.5: Payment Tracking, Money In/Out Ledger,
-- Balance Sheet, Purchases module.
--
-- Design note (confirmed with user): additive only — no changes to biz_expenses or
-- existing P&L logic. payment_mode + is_paid already existed on biz_sales (§2.1's
-- "payment received" ask was already built, not duplicated here).
--
-- Income model: Studio Sales are NOT logged here — they're already captured per-order
-- on biz_sales (channel='shop', is_paid=true = cash/UPI collected at sale time; counting
-- them again here would double-count). biz_income is for money that arrives SEPARATELY
-- from the per-order sale record: Flipkart/Amazon/Website payouts (settled later, in a
-- batch, distinct from when the order itself was logged) and one-off misc income.
--
-- Idempotent — safe to run multiple times.
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.biz_income (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  category       TEXT NOT NULL DEFAULT 'other'
                 CHECK (category IN ('flipkart_payout','amazon_payout','website_payout','misc')),
  amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_mode   TEXT,              -- cash/upi/card/bank_transfer/online
  bank_reference TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.biz_income ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_income" ON public.biz_income;
CREATE POLICY "biz_admin_only_income" ON public.biz_income
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com');
CREATE INDEX IF NOT EXISTS biz_income_date_idx ON public.biz_income (date DESC);

CREATE TABLE IF NOT EXISTS public.biz_purchases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor         TEXT,
  category       TEXT NOT NULL DEFAULT 'raw_material'
                 CHECK (category IN ('raw_material','packaging','equipment','other')),
  item           TEXT NOT NULL,
  qty            NUMERIC(10,2) DEFAULT 1,
  unit_amount    NUMERIC(10,2) DEFAULT 0,
  total_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  invoice_url    TEXT,              -- path in the 'biz-invoices' Storage bucket (same pattern as biz_expenses)
  linked_roll_id UUID REFERENCES public.biz_filament_rolls(id) ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.biz_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_purchases" ON public.biz_purchases;
CREATE POLICY "biz_admin_only_purchases" ON public.biz_purchases
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com');
CREATE INDEX IF NOT EXISTS biz_purchases_date_idx ON public.biz_purchases (date DESC);

-- Stock valuation needs a cost basis per roll — remaining grams alone can't produce a ₹ value.
ALTER TABLE public.biz_filament_rolls ADD COLUMN IF NOT EXISTS cost_total NUMERIC(10,2);

-- Opening bank balance lives in site_settings (key 'biz_opening_balance'), matching the
-- existing lightweight admin-tunable-value convention (biz_fee_rules, doc_invoice_fields).
-- No row inserted here — the Balance Sheet UI treats a missing key as ₹0 until the admin sets it.

-- §2.6 — Shop open/close log. Informational only — does not feed any other calculation.
CREATE TABLE IF NOT EXISTS public.biz_shop_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL UNIQUE,
  closed_all_day BOOLEAN DEFAULT false,
  reason       TEXT,
  open_time    TIME,
  close_time   TIME,
  break_start  TIME,
  break_end    TIME,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.biz_shop_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_shop_log" ON public.biz_shop_log;
CREATE POLICY "biz_admin_only_shop_log" ON public.biz_shop_log
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com');

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- INSERT INTO biz_income(category,amount) VALUES('flipkart_payout',1000); -- should succeed
-- INSERT INTO biz_purchases(item,total_amount) VALUES('PLA filament 1kg',799); -- should succeed
-- ════════════════════════════════════════════════════════════════════════════════
