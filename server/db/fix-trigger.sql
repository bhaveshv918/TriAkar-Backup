-- TriAkar: Fix mobile-on-signup
-- Run this in the Supabase SQL Editor.
-- Makes every new signup's mobile number land in profiles.mobile,
-- so it shows in the admin Customers tab. Also backfills existing users.

-- ── 1. Ensure the columns the app reads actually exist ──────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email  TEXT;

-- Helps the duplicate-mobile check at signup
CREATE INDEX IF NOT EXISTS idx_profiles_mobile ON public.profiles (mobile);

-- ── 2. Recreate the new-user trigger so it captures the mobile ──────
-- The signup backend stores the number in user_metadata under either
-- 'mobile' or 'phone' — read whichever is present.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, mobile, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'mobile', new.raw_user_meta_data->>'phone'),
    new.email
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    mobile    = COALESCE(EXCLUDED.mobile,    public.profiles.mobile),
    email     = COALESCE(EXCLUDED.email,     public.profiles.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Attach the trigger to auth.users ─────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 4. Backfill existing users ──────────────────────────────────────
-- Copy any legacy 'phone' value into 'mobile' where mobile is still empty.
UPDATE public.profiles
SET mobile = phone
WHERE (mobile IS NULL OR mobile = '')
  AND phone IS NOT NULL AND phone <> '';

-- Pull mobile + email straight from auth metadata for anyone still missing it.
UPDATE public.profiles p
SET mobile = COALESCE(p.mobile, u.raw_user_meta_data->>'mobile', u.raw_user_meta_data->>'phone'),
    email  = COALESCE(p.email,  u.email)
FROM auth.users u
WHERE p.id = u.id
  AND (p.mobile IS NULL OR p.mobile = '' OR p.email IS NULL OR p.email = '');
