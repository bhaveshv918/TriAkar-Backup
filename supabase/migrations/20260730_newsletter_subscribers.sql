-- TriAkar — Footer newsletter signup
--
-- The homepage editorial redesign adds a "Stay inspired" email capture to the site-wide
-- footer. Submissions go through POST /api/newsletter (server/controllers/newsletterController.js)
-- using the backend's service-role Supabase client, so no public RLS policy is needed —
-- RLS stays enabled with no policies, matching the "RLS on every table" rule.
--
-- Safe, additive. Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
