-- One-off fix-up: two non-PLA "Black" spools were sitting marked Finsh/0% by
-- mistake. Every Black PLA (any brand) is correctly Finsh/0%, left as-is.
-- These two are not PLA, so they're reopened at full 100% (grams_used=0,
-- waste_grams=0), status back to Opened.
-- Applied directly via Supabase service role on 2026-07-10; kept here for the audit trail.

UPDATE filament_inventory
SET status='Opened', grams_used=0, waste_grams=0, opened_date=CURRENT_DATE, finished_date=NULL
WHERE s_no IN (75, 91);
-- s_no 75: Numakers ABS "Pitch Black"
-- s_no 91: ESUN PETG "Black"
