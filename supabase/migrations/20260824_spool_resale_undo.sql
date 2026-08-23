-- TriAkar Business OS — Undo Resell for filament_inventory
-- Lets an accidental "Mark resold" (Spool Tracker) or a deleted order that sold a
-- whole spool as merchandise be reverted cleanly, restoring the spool's exact
-- pre-resale state instead of guessing. Safe, additive. Run once in Supabase SQL Editor.

-- Snapshot of the spool's state right before this resale, so undo can restore it
-- exactly rather than assuming Packed/0g (a spool resold mid-use had real
-- grams_used/waste_grams/status/dates that would otherwise be lost).
ALTER TABLE biz_filament_resales
  ADD COLUMN IF NOT EXISTS pre_grams_used   NUMERIC,
  ADD COLUMN IF NOT EXISTS pre_waste_grams  NUMERIC,
  ADD COLUMN IF NOT EXISTS pre_status       TEXT,
  ADD COLUMN IF NOT EXISTS pre_opened_date  DATE,
  ADD COLUMN IF NOT EXISTS pre_finished_date DATE,
  ADD COLUMN IF NOT EXISTS order_ref        TEXT,   -- business order_id, set only for whole-spool-as-merchandise sales made via Add Order
  ADD COLUMN IF NOT EXISTS reverted         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reverted_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS biz_filament_resales_order_ref_idx ON biz_filament_resales (order_ref);

-- Existing (pre-migration) resale rows have no snapshot to restore from; Undo Resell
-- on those falls back to Packed/0g in the app (documented in the button's tooltip),
-- which is the best we can do since the true prior state was never recorded.

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT id, spool_id, buyer_name, reverted, order_ref FROM biz_filament_resales ORDER BY created_at DESC LIMIT 20;
-- ════════════════════════════════════════════════════════════════════════════════
