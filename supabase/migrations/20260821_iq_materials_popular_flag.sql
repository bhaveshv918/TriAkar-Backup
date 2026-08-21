-- Instant Quote materials: add a "Popular" badge flag independent of is_default.
-- is_default controls which material auto-selects on load/reset (exactly one row,
-- enforced in the admin UI). "Popular" is just a merchandising badge and multiple
-- materials can carry it at once, so it needs its own column rather than reusing
-- is_default. Safe, additive. Run once in Supabase SQL Editor.

ALTER TABLE instant_quote_materials ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;

UPDATE instant_quote_materials SET is_popular = true WHERE name = 'ABS';
