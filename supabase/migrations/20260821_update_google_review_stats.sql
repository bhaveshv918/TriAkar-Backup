-- Syncs the homepage/reviews-page Google rating badge with the current
-- Google Business Profile listing (5.0 stars, 25 reviews, checked 2026-08-21).
-- site_settings takes priority over the hardcoded fallback in reviews.html
-- at runtime, so this is the row that actually needs updating for the badge
-- to change on the live site; run in the Supabase SQL Editor.

INSERT INTO site_settings (key, value, updated_at) VALUES
  ('google_rating', '5.0', now()),
  ('google_review_count', '25', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
