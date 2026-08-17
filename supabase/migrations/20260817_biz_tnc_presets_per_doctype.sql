-- TriAkar Business OS — Terms & Conditions rebuild: per-document presets + defaults
-- Previously biz_tnc_presets was one flat shared list, manually inserted into
-- whichever T&C/Notes field, and Order Record had no Terms & Conditions field
-- at all (only the separate internal "Notes"/Special Instructions field).
-- This adds:
--   1. record_terms_notes on biz_sales, Order Record's own T&C, independent of
--      the existing terms_notes column (which stays Invoice's T&C).
--   2. doc_type on biz_tnc_presets, scoping each preset to exactly one of the
--      three documents (record / invoice / quotation) instead of showing in all
--      three insert-a-preset dropdowns at once.
--   3. is_default + a partial unique index, so exactly one preset per doc_type
--      can be marked default and auto-fills a blank field on a new order/quotation.
-- Existing presets default to doc_type='invoice' (least-disruptive guess, they
-- were mostly used there); re-tag/recreate any that actually belong under Order
-- Record or Quotation from the Terms & Notes Presets settings panel.
-- Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE biz_sales
  ADD COLUMN IF NOT EXISTS record_terms_notes TEXT;

ALTER TABLE biz_tnc_presets
  ADD COLUMN IF NOT EXISTS doc_type TEXT NOT NULL DEFAULT 'invoice' CHECK (doc_type IN ('record','invoice','quotation')),
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS biz_tnc_presets_one_default_per_type
  ON biz_tnc_presets(doc_type) WHERE is_default;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT doc_type, name, is_default FROM biz_tnc_presets ORDER BY doc_type, name;
-- ════════════════════════════════════════════════════════════════════════════════
