-- TriAkar : per-material colour palettes for Instant Quote
--
-- What the studio actually stocks:
--   PLA+          the full catalog, plus any custom hex (the site's colour picker)
--   TPU           White only
--   everything else   Black / White / Grey
--
-- instant_quote_materials.limited_colors matches instant_quote_colors.name EXACTLY, and the
-- catalog is seeded with 'Grey', not 'Gray'. Hardcoding the American spelling would produce
-- a palette that silently resolves to Black and White with Grey quietly missing, with no
-- error anywhere. So the real spellings are read back out of the colours table instead of
-- being written in by hand, and the migration refuses to run if they are not there.
--
-- Idempotent, safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  neutral_names TEXT[];
  white_names   TEXT[];
BEGIN
  SELECT array_agg(name ORDER BY sort_order) INTO neutral_names
    FROM public.instant_quote_colors
   WHERE active AND lower(btrim(name)) IN ('black', 'white', 'grey', 'gray');

  SELECT array_agg(name ORDER BY sort_order) INTO white_names
    FROM public.instant_quote_colors
   WHERE active AND lower(btrim(name)) = 'white';

  -- Fail loudly rather than leaving a material with a palette that filters to nothing.
  -- A customer facing an empty colour row cannot complete a quote at all.
  IF neutral_names IS NULL OR array_length(neutral_names, 1) < 3 THEN
    RAISE EXCEPTION 'Need active Black, White and Grey in instant_quote_colors, found: %',
      coalesce(neutral_names::TEXT, 'none');
  END IF;
  IF white_names IS NULL THEN
    RAISE EXCEPTION 'No active White in instant_quote_colors, TPU would be left with no colours';
  END IF;

  -- PLA+ : no restriction. The custom hex picker on instant-quote.html is gated to this
  -- material, so its palette has to stay open.
  UPDATE public.instant_quote_materials
     SET limited_colors = NULL
   WHERE upper(btrim(coalesce(filament_type, name))) = 'PLA+';

  -- TPU : White only.
  UPDATE public.instant_quote_materials
     SET limited_colors = white_names
   WHERE upper(btrim(coalesce(filament_type, name))) = 'TPU';

  -- Everything else, including ABS which was previously Black/White only.
  UPDATE public.instant_quote_materials
     SET limited_colors = neutral_names
   WHERE upper(btrim(coalesce(filament_type, name))) NOT IN ('PLA+', 'TPU');
END $$;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- Expect PLA+ NULL, TPU {White}, everything else {Black,White,Grey}:
--   SELECT name, filament_type, active, limited_colors
--     FROM instant_quote_materials ORDER BY active DESC, sort_order;
-- No active material should end up with a palette that matches zero colours:
--   SELECT m.name, m.limited_colors
--     FROM instant_quote_materials m
--    WHERE m.active AND m.limited_colors IS NOT NULL
--      AND NOT EXISTS (SELECT 1 FROM instant_quote_colors c
--                       WHERE c.active AND c.name = ANY(m.limited_colors));
-- ════════════════════════════════════════════════════════════════════════════════
