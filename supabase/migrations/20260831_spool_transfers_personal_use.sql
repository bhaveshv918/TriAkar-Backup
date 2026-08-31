-- TriAkar, spool transfers between branches + personal-use consumption.
-- 2026-08-31. Run in the Supabase SQL Editor after 20260830_branches.sql.
-- Idempotent, safe to run twice.
--
-- Two things Gurugram needs that Noida never did:
--
--  1. Spools physically move between branches. The stock has to move with them, and
--     both sides need to be able to answer "where did this spool go / come from"
--     months later, so the move is a record rather than a silent branch_id edit.
--
--  2. A branch prints things for itself. That is not a sale and not a gift to a
--     customer, but the filament is genuinely gone, so it has to leave the spool and
--     land in expenses. Otherwise material quietly evaporates out of the books.
-- ════════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════════
-- 1. TRANSFER LEDGER
-- ════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.biz_spool_transfers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spool_id       INTEGER REFERENCES public.filament_inventory(id) ON DELETE SET NULL,
  -- Denormalised so the row still reads correctly after the spool is finished,
  -- resold or deleted. A transfer record that says "spool 47 went to Gurugram on
  -- the 3rd" is useless if spool 47 no longer resolves to anything.
  spool_label    TEXT,
  from_branch    TEXT REFERENCES public.biz_branches(id),
  to_branch      TEXT NOT NULL REFERENCES public.biz_branches(id),
  grams_left     NUMERIC(10,2),   -- what was actually on the spool when it moved
  transferred_by TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biz_spool_transfers_spool_idx ON public.biz_spool_transfers (spool_id);
CREATE INDEX IF NOT EXISTS biz_spool_transfers_when_idx  ON public.biz_spool_transfers (created_at DESC);
CREATE INDEX IF NOT EXISTS biz_spool_transfers_to_idx    ON public.biz_spool_transfers (to_branch, created_at DESC);

-- Deliberately NOT given a branch_id column and NOT put under trg_stamp_branch. A
-- transfer belongs to two branches at once, so a single branch_id would be a lie and
-- the stamp trigger would overwrite one end of it.
ALTER TABLE public.biz_spool_transfers ENABLE ROW LEVEL SECURITY;

-- Owner does everything. Staff can only READ, and only transfers their own branch was
-- part of, so Gurugram can see what arrived without being able to move stock around.
DROP POLICY IF EXISTS biz_spool_transfers_owner ON public.biz_spool_transfers;
CREATE POLICY biz_spool_transfers_owner ON public.biz_spool_transfers
  FOR ALL TO authenticated
  USING ((SELECT public.is_biz_owner())) WITH CHECK ((SELECT public.is_biz_owner()));

DROP POLICY IF EXISTS biz_spool_transfers_staff_read ON public.biz_spool_transfers;
CREATE POLICY biz_spool_transfers_staff_read ON public.biz_spool_transfers
  FOR SELECT TO authenticated
  USING ((SELECT public.is_biz_staff())
         AND (SELECT public.staff_branch()) IN (from_branch, to_branch));

-- ════════════════════════════════════════════════════════════════════════════════
-- 2. PERSONAL USE
--
-- Rides on biz_sales rather than getting its own table, because everything a personal
-- print needs already exists there: the spool link, grams used, waste, branch scoping,
-- the audit trigger and the order history. A separate table would mean reimplementing
-- all of it and the entry would appear in none of the existing views.
--
-- Same shape as is_gift, which is already the "₹0 revenue, cost goes to expenses"
-- pattern in this system. selling_price stays 0, so every revenue sum is correct
-- without a single one of them needing to learn about this flag.
-- ════════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.biz_sales
  ADD COLUMN IF NOT EXISTS is_personal_use BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS biz_sales_personal_use_idx
  ON public.biz_sales (branch_id, is_personal_use) WHERE is_personal_use;

-- Lets the Expenses tab and the Balance Sheet tell a personal print apart from a
-- customer gift, since both land in the same category.
COMMENT ON COLUMN public.biz_sales.is_personal_use IS
  'Printed for the branch itself, not sold. Zero revenue, filament cost logged as an expense.';

-- ── Self-register ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    INSERT INTO schema_migrations (filename) VALUES ('20260831_spool_transfers_personal_use.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END $$;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='biz_sales' AND column_name='is_personal_use';
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE tablename='biz_spool_transfers' ORDER BY policyname;
-- SELECT * FROM biz_spool_transfers ORDER BY created_at DESC LIMIT 10;
-- ════════════════════════════════════════════════════════════════════════════════
