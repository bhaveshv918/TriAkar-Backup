-- TriAkar — Module 3: review admin-reply + 'flagged' status, and Google-review
--           storefront stats moved into site_settings (admin-editable, no deploy).
-- Date: 2026-06-23
--
-- RLS: NOT modified. site_settings already has public-read / admin-write policies
--      (20260613_site_settings.sql). reviews keeps its existing policies.
-- Idempotent — safe to run multiple times.
-- ════════════════════════════════════════════════════════════════════════════════

-- ── 1. Public admin reply, shown under a review on the storefront ─────────────────
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS admin_reply TEXT;

-- ── 2. Allow a 'flagged' moderation status (was pending/approved/rejected) ─────────
-- Drop whatever the status CHECK is currently named, then recreate it widened.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.reviews'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%IN%'
  LOOP
    EXECUTE 'ALTER TABLE public.reviews DROP CONSTRAINT ' || quote_ident(c.conname);
  END LOOP;
END $$;

ALTER TABLE public.reviews ADD CONSTRAINT reviews_status_check
  CHECK (status IN ('pending','approved','rejected','flagged'));

-- ── 3. Seed Google-review storefront stats ───────────────────────────────────────
-- Seeded with the values currently hard-coded in reviews.html so nothing regresses;
-- the admin edits these from the panel afterwards (no code deploy needed).
-- google_snippets holds a JSON array: [{ "text": "...", "author": "...", "rating": 5 }]
INSERT INTO public.site_settings (key, value) VALUES
  ('google_rating',       '5.0'),
  ('google_review_count', '13'),
  ('google_profile_url',  'https://maps.app.goo.gl/Ki2GXFgi6JUZMb7z6'),
  ('google_snippets',     '[]')
ON CONFLICT (key) DO NOTHING;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- SELECT key, value FROM site_settings WHERE key LIKE 'google_%';
-- INSERT INTO reviews(product_slug,reviewer_name,rating,review,status) VALUES('x','y',5,'z','flagged'); -- should succeed
-- ════════════════════════════════════════════════════════════════════════════════
