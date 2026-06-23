-- TriAkar — Soft-delete (Recycle Bin) for products / profiles / reviews
--           + admin user-management fields on profiles
-- Date: 2026-06-23   |   Modules 1 (Recycle Bin) + 2 (User Management)
--
-- WHAT THIS DOES
--   1. Adds deleted_at / deleted_by to products, profiles, reviews.
--      (orders, contact_submissions, custom_enquiries, callback_requests already
--       have these from earlier migrations — not touched here.)
--   2. Adds role + disabled to profiles (display/filter + enable-disable mirror).
--   3. Indexes deleted_at for fast active-vs-binned filtering.
--   4. Auto-purge: a pg_cron job hard-deletes bin items older than 30 days from
--      reviews, products, contact_submissions, custom_enquiries, callback_requests.
--      Orders and profiles/users are intentionally EXCLUDED (financial / destructive);
--      they can still be permanently deleted MANUALLY from the Recycle Bin.
--
-- RLS: NOT MODIFIED. Every admin read/write for users, products and reviews runs
--      through the Express service-role API, which bypasses RLS. This migration does
--      NOT add, drop, or alter a single RLS policy.
--
-- Idempotent — safe to run multiple times.
-- ════════════════════════════════════════════════════════════════════════════════

-- ── 1. Soft-delete columns ───────────────────────────────────────────────────────
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE public.reviews  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.reviews  ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- ── 2. User-management fields on profiles ────────────────────────────────────────
-- role: a display/filter tag ONLY. Admin ACCESS stays the email allowlist in
-- server/middleware/requireAdmin.js — this column does NOT grant any privilege.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';

-- disabled: mirrors the Supabase Auth ban state so the admin list can filter/sort on it.
-- Login is actually blocked by the Auth ban (set server-side); this flag is for display.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false;

-- ── 3. Indexes (partial — only binned rows, keeps them tiny) ──────────────────────
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON public.products (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_deleted_at  ON public.reviews  (deleted_at) WHERE deleted_at IS NOT NULL;

-- ── 4. Auto-purge function (30-day hard delete) ──────────────────────────────────
-- SECURITY DEFINER so the scheduled job deletes regardless of RLS.
CREATE OR REPLACE FUNCTION public.purge_old_recycle_bin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff TIMESTAMPTZ := now() - INTERVAL '30 days';
BEGIN
  -- Products: keep any referenced by an order (financial history). Only purge
  -- never-ordered binned products — this also avoids order_items FK violations.
  DELETE FROM public.products p
   WHERE p.deleted_at IS NOT NULL
     AND p.deleted_at < cutoff
     AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.product_id = p.id);

  DELETE FROM public.reviews             WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.contact_submissions WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.custom_enquiries    WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.callback_requests   WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;

  -- NOTE: orders and profiles/users are intentionally NOT auto-purged.
END;
$$;

-- ── 5. Schedule daily at 03:00 UTC via pg_cron (only if the extension is on) ──────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-recycle-bin') THEN
      PERFORM cron.unschedule('purge-recycle-bin');
    END IF;
    PERFORM cron.schedule('purge-recycle-bin', '0 3 * * *', 'SELECT public.purge_old_recycle_bin();');
    RAISE NOTICE 'Recycle-bin purge scheduled daily at 03:00 UTC.';
  ELSE
    RAISE NOTICE 'pg_cron NOT enabled. Enable it (Dashboard > Database > Extensions > pg_cron), then run once:';
    RAISE NOTICE '  SELECT cron.schedule(''purge-recycle-bin'', ''0 3 * * *'', ''SELECT public.purge_old_recycle_bin();'');';
  END IF;
END $$;

-- ── VERIFY ───────────────────────────────────────────────────────────────────────
-- New columns:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='profiles' AND column_name IN ('deleted_at','deleted_by','role','disabled');
-- Scheduled job:
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname='purge-recycle-bin';
-- Dry-run the purge by hand:
--   SELECT public.purge_old_recycle_bin();
-- ════════════════════════════════════════════════════════════════════════════════
