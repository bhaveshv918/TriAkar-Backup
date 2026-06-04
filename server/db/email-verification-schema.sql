-- ── Email Verification Schema ─────────────────────────────
-- Run this in Supabase SQL Editor before deploying.
-- The phone_otps table (already exists) is reused to store
-- email OTPs with phone = 'email:<address>' as the key.

-- Add email_verified flag to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
