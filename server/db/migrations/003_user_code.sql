-- ══════════════════════════════════════════════════════════════
-- Migration 003: TriAkar UserID (user_code) — 12-digit customer identity
--
-- Format: DDMMYY + 6-random  (e.g. 020626847391 = 2-Jun-2026)
-- The date encoding (DDMMYY) is known only to TriAkar.
-- Run in Supabase SQL Editor. Safe to run multiple times.
-- ══════════════════════════════════════════════════════════════

-- 1. Add user_code column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_code TEXT UNIQUE;

-- 2. Generator function — DDMMYY + 6 random digits, collision-safe
CREATE OR REPLACE FUNCTION generate_user_code(signup_ts TIMESTAMPTZ DEFAULT NOW())
RETURNS TEXT AS $$
DECLARE
  base  TEXT;
  code  TEXT;
  tries INT := 0;
BEGIN
  base := TO_CHAR(signup_ts, 'DDMMYY');
  LOOP
    code := base || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE user_code = code);
    tries := tries + 1;
    IF tries > 20 THEN
      RAISE EXCEPTION 'generate_user_code: could not find unique code after 20 tries';
    END IF;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger: auto-assign user_code on INSERT if not already set
CREATE OR REPLACE FUNCTION trg_assign_user_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_code IS NULL THEN
    NEW.user_code := generate_user_code(COALESCE(NEW.created_at, NOW()));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_code ON profiles;
CREATE TRIGGER trg_user_code
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION trg_assign_user_code();

-- 4. Backfill existing profiles that have no user_code
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, created_at FROM profiles WHERE user_code IS NULL LOOP
    UPDATE profiles
    SET user_code = generate_user_code(COALESCE(r.created_at, NOW()))
    WHERE id = r.id;
  END LOOP;
END $$;

-- 5. Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_user_code ON profiles(user_code);

-- 6. RLS: users can read their own user_code via profiles (already covered by existing policy)
-- No additional policy needed — existing "Users read own profile" covers it.

-- Verify:
-- SELECT id, full_name, user_code, created_at FROM profiles ORDER BY created_at LIMIT 10;
