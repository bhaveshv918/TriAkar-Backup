-- ── Email Verification Schema ─────────────────────────────
-- Run this in Supabase SQL Editor before deploying.
-- Safe to run multiple times (IF NOT EXISTS guards).

-- 1. Add email_verified flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- 2. Add email column to phone_otps so email OTPs can be stored/queried by email
--    (The server uses phone = '0000000000' + email = <address> for email OTP rows)
ALTER TABLE public.phone_otps ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_phone_otps_email ON public.phone_otps(email);
