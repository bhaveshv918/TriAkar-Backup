-- TriAkar Business OS — Filament resale system
-- Distinguishes spools finished by in-house printing use vs resold to another
-- customer/print-shop, and tracks resale profit + feeds Money In / Balance Sheet.
-- Safe, additive. Run once in Supabase SQL Editor.

-- 1. Why a spool became 'Finsh' — 'used' (printed with) or 'resold' (sold whole,
--    never printed with). Without this, resold spools looked identical to
--    consumed ones and inflated in-house consumption/COGS stats.
ALTER TABLE filament_inventory
  ADD COLUMN IF NOT EXISTS finish_reason TEXT CHECK (finish_reason IN ('used','resold'));

-- Backfill: every spool already marked Finsh before this feature existed was
-- genuine in-house consumption (resale wasn't tracked as a concept until now).
UPDATE filament_inventory
SET finish_reason = 'used'
WHERE status = 'Finsh' AND finish_reason IS NULL;

-- 2. Resale ledger — one row per spool resold, links to the spool and to the
--    Money In entry it generated, so a resale is fully traceable both ways.
CREATE TABLE IF NOT EXISTS biz_filament_resales (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spool_id     INTEGER REFERENCES filament_inventory(id) ON DELETE SET NULL,
  buyer_name   TEXT NOT NULL,
  cost_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
  sale_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
  profit       NUMERIC(10,2) GENERATED ALWAYS AS (sale_price - cost_price) STORED,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT,
  income_id    UUID REFERENCES biz_income(id) ON DELETE SET NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE biz_filament_resales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_admin_only_filament_resales" ON biz_filament_resales;
CREATE POLICY "biz_admin_only_filament_resales" ON biz_filament_resales
  FOR ALL TO authenticated
  USING ((SELECT auth.email())='bhaveshv918@gmail.com')
  WITH CHECK ((SELECT auth.email())='bhaveshv918@gmail.com');
CREATE INDEX IF NOT EXISTS biz_filament_resales_date_idx ON biz_filament_resales (date DESC);
CREATE INDEX IF NOT EXISTS biz_filament_resales_spool_idx ON biz_filament_resales (spool_id);

-- 3. Give resale income its own category instead of dumping it into 'misc',
--    so it's queryable/reportable on its own in the Balance Sheet / Money In views.
-- NOTE: Postgres rewrites CHECK (col IN (...)) as CHECK (col = ANY (ARRAY[...]))
-- internally, so matching on the literal substring 'IN' is unreliable — match
-- on the column name alone instead.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.biz_income'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%category%'
  LOOP
    EXECUTE 'ALTER TABLE public.biz_income DROP CONSTRAINT ' || quote_ident(c.conname);
  END LOOP;
END $$;

ALTER TABLE public.biz_income ADD CONSTRAINT biz_income_category_check
  CHECK (category IN ('flipkart_payout','amazon_payout','website_payout','filament_resale','misc'));

-- 4. Backfill the Yatin resale (5 spools, Inv DL/0579, 11-Jul-26) into the new
--    structure — re-tag the existing biz_income row and add resale ledger rows.
UPDATE biz_income
SET category = 'filament_resale'
WHERE notes LIKE '%Yatin%' AND category = 'misc';

INSERT INTO biz_filament_resales (spool_id, buyer_name, cost_price, sale_price, date, payment_mode, income_id, notes)
SELECT fi.id, 'Yatin', 600.00, 700.00, '2026-07-11'::date, 'cash',
       (SELECT id FROM biz_income WHERE notes LIKE '%Yatin%' AND category='filament_resale' LIMIT 1),
       'Backfilled from Inv DL/0579 resale'
FROM filament_inventory fi
WHERE fi.notes LIKE 'Inv DL/0579%resold to Yatin%'
  AND NOT EXISTS (SELECT 1 FROM biz_filament_resales r WHERE r.spool_id = fi.id);

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT finish_reason, count(*) FROM filament_inventory WHERE status='Finsh' GROUP BY 1;
-- SELECT * FROM biz_filament_resales ORDER BY date DESC;
-- SELECT category, count(*), sum(amount) FROM biz_income GROUP BY 1;
-- ════════════════════════════════════════════════════════════════════════════════
