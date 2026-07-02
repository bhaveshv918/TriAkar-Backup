-- TriAkar Business OS — remove the old "Filament" (roll-based) system entirely.
-- Run AFTER 20260703_spool_tracker_upgrade.sql. Spool Tracker (filament_inventory) replaces it.

DROP TABLE IF EXISTS biz_filament_rolls CASCADE;
DELETE FROM site_settings WHERE key IN ('biz_filament_min_rolls','biz_color_suggestions');
