-- Round-2 #14 — add Company/Brand to filament rolls (Supplier already exists).
-- Until this runs, the app strips the column on save and retries, so rolls still
-- save (just without the company value).
ALTER TABLE biz_filament_rolls ADD COLUMN IF NOT EXISTS company TEXT;
