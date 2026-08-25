-- TriAkar : retire plain PLA from Instant Quote, PLA+ is the only PLA offered
--
-- The catalog seeded both 'PLA+' and 'PLA' (20260816_instant_quote_v2.sql). The studio only
-- stocks and sells PLA+, so plain PLA was an option customers could pick and we would then
-- have to talk them out of. PLA+ is also the one filament carried in enough shades to match
-- an arbitrary custom colour, which is why the new colour picker is gated to it.
--
-- Deactivated, NOT deleted. instant_quote_requests rows reference material_id, so deleting
-- would either break that foreign key or silently orphan the material on every historical
-- quote that used it. active=false is enough: /api/instant-quote/options and the price
-- endpoint both filter on active, so it disappears for customers while old quotes still
-- resolve their material name in the admin panel.
--
-- Idempotent, safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════

UPDATE public.instant_quote_materials
   SET active = false
 WHERE active = true
   AND upper(btrim(coalesce(filament_type, name))) = 'PLA';

-- PLA+ must be the default now that plain PLA is gone. If plain PLA happened to be the
-- default, the quoter would open with nothing sensibly preselected.
UPDATE public.instant_quote_materials SET is_default = false
 WHERE is_default = true
   AND upper(btrim(coalesce(filament_type, name))) <> 'PLA+';

UPDATE public.instant_quote_materials SET is_default = true
 WHERE active = true
   AND upper(btrim(coalesce(filament_type, name))) = 'PLA+';

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- Expect exactly one active PLA-family row, PLA+, and it should be the default:
--   SELECT name, filament_type, active, is_default, sort_order
--     FROM instant_quote_materials
--    ORDER BY active DESC, sort_order;
-- Historical quotes that used plain PLA still resolve their material:
--   SELECT count(*) FROM instant_quote_requests r
--     JOIN instant_quote_materials m ON m.id = r.material_id
--    WHERE upper(btrim(coalesce(m.filament_type, m.name))) = 'PLA';
-- ════════════════════════════════════════════════════════════════════════════════
