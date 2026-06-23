-- TriAkar — Module 7: admin activity log (who did what, when)
-- Date: 2026-06-23
--
-- Written ONLY by the service-role backend (adminUser/adminRecycle/admin/review
-- controllers). RLS is enabled with NO policies, so the public anon/auth roles get
-- nothing — an audit log should never be readable from the browser client. The
-- admin panel reads it through the service-role API (GET /api/admin/activity).
-- Idempotent.
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.admin_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email TEXT,
  action      TEXT NOT NULL,         -- e.g. user.disable, product.bulk, review.delete
  entity_type TEXT,                  -- user | product | review | order | recycle
  entity_id   TEXT,
  detail      TEXT,                  -- short human-readable summary
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON public.admin_activity (created_at DESC);

ALTER TABLE public.admin_activity ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies → only the service-role backend can read/write it.
