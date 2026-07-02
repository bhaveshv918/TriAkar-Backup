-- TriAkar — Spool Tracker: exact color swatch. Free-text color names ("Golden Silk",
-- "Shiny Gold") can't be reliably matched to a real color programmatically, so this adds
-- an actual hex value the admin picks once per spool — accurate by construction, not by
-- guessing from the name. The color NAME field is kept as-is for search/reference.
-- Idempotent — safe to run multiple times.
ALTER TABLE public.filament_inventory ADD COLUMN IF NOT EXISTS color_hex TEXT;
