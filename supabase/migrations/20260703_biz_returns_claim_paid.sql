-- TriAkar — Returns & Claims: track when an approved claim actually lands in the bank.
-- Filed amount and approved amount were already tracked (claim_filed_amount,
-- claim_approved_amount), but the gap between "approved" and "the money is actually in
-- the bank, bundled into a later payout" was untracked — this closes that loop.
-- No CHECK constraint on `stage` (free text since 20260625_biz_returns_lifecycle.sql),
-- so a new 'claim_paid' stage value needs no schema change beyond these two columns.
-- Idempotent — safe to run multiple times.
ALTER TABLE public.biz_returns ADD COLUMN IF NOT EXISTS claim_paid_date   DATE;
ALTER TABLE public.biz_returns ADD COLUMN IF NOT EXISTS claim_paid_amount NUMERIC(10,2);
