-- TriAkar — customer_country on biz_sales / biz_quotations
--
-- Add Order / quotation forms assumed every customer was in India: State was a
-- required dropdown of Indian states/UTs with no way to leave it blank, and there
-- was no Country field at all. State is no longer required in the UI and a Country
-- input (free text, defaults to "India") has been added — this column is where it's
-- stored. Existing rows default to 'India' since every order so far has been
-- domestic; new rows write whatever the operator actually typed.
--
-- Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_sales ADD COLUMN IF NOT EXISTS customer_country TEXT DEFAULT 'India';
ALTER TABLE biz_quotations ADD COLUMN IF NOT EXISTS customer_country TEXT DEFAULT 'India';

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name='biz_sales' AND column_name='customer_country';
-- SELECT column_name FROM information_schema.columns WHERE table_name='biz_quotations' AND column_name='customer_country';
-- ════════════════════════════════════════════════════════════════════════════════
