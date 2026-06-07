-- ═══════════════════════════════════════════════════════════════════
-- TriAkar — Migration 004: Listing fields (occasions, designer credit,
--           licence record, rule-based pricing inputs)
-- Run in Supabase SQL Editor. Safe to run multiple times (additive).
-- See PRODUCT-LISTING-PROCESS.md §3.
-- ═══════════════════════════════════════════════════════════════════

-- ── Occasions ───────────────────────────────────────────────────────
-- Stored, multi-value. Drives the storefront occasion filter pills.
-- Allowed values: birthday | anniversary | corporate | housewarming | last-minute
ALTER TABLE products ADD COLUMN IF NOT EXISTS occasions TEXT[] DEFAULT '{}';

-- ── Designer credit + licence record ────────────────────────────────
-- `designer` (the display name, shown publicly) already exists.
-- license + source_url are ADMIN-ONLY — never rendered on the public site.
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url    TEXT;     -- original model page (admin reference)
ALTER TABLE products ADD COLUMN IF NOT EXISTS license       TEXT;     -- e.g. 'CC-BY', 'CC-BY-NC', 'own', 'unknown'
ALTER TABLE products ADD COLUMN IF NOT EXISTS commercial_ok BOOLEAN DEFAULT false;

-- ── Pricing inputs (rule-based pricing, see §6) ─────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS est_grams       NUMERIC(10,2);  -- filament grams
ALTER TABLE products ADD COLUMN IF NOT EXISTS est_print_hours NUMERIC(10,2);  -- print time (hours)
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_class      TEXT;           -- S | M | L | XL

-- ── Verify (optional) ───────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'products'
--     AND column_name IN ('occasions','source_url','license','commercial_ok',
--                         'est_grams','est_print_hours','size_class')
--   ORDER BY column_name;
