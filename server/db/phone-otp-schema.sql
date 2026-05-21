-- ── Phone OTP Verification Schema ────────────────────────────
-- Run this in Supabase SQL Editor

-- 1. OTP verifications table
CREATE TABLE IF NOT EXISTS public.phone_otps (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone      TEXT NOT NULL,
  otp        TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON public.phone_otps(phone);
CREATE INDEX IF NOT EXISTS idx_phone_otps_expires ON public.phone_otps(expires_at);

-- Auto-clean expired/old OTPs (keep last 7 days only)
-- You can run this manually or set up a pg_cron job:
-- DELETE FROM public.phone_otps WHERE created_at < NOW() - INTERVAL '7 days';

-- 2. Add phone_verified column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- 3. Disable RLS on phone_otps (server-side only, no direct client access needed)
ALTER TABLE public.phone_otps DISABLE ROW LEVEL SECURITY;

-- 4. Pending SQL from earlier sessions
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_charge NUMERIC(10,2);
