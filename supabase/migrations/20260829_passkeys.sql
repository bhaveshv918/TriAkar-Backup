-- TriAkar : passkeys (WebAuthn) as a primary, passwordless sign-in method
--
-- Customers mostly sign in on a phone. Typing an email plus a password on a phone is the
-- slowest part of the whole account flow, and it is the reason people bounce to "continue
-- as guest" elsewhere. A passkey replaces both with Face ID / fingerprint / device PIN,
-- and it is phishing-resistant: the credential is bound to the exact domain, so a lookalike
-- site cannot collect anything reusable.
--
-- How this sits inside the existing auth:
--   Nothing about Supabase Auth changes. A passkey never becomes the session. The server
--   verifies the WebAuthn signature against the stored public key, and only then mints a
--   normal Supabase session for that user (admin generateLink -> verifyOtp). So RLS, the
--   requireAuth middleware, token refresh, and every existing API keep working unchanged.
--   Password login, Google OAuth and email OTP all stay exactly as they are: a passkey is
--   an additional door, never a replacement for the ones already there.
--
-- Two tables:
--   user_passkeys        one row per registered credential (a user can have several:
--                        phone, laptop, security key)
--   webauthn_challenges  short-lived one-time challenges. WebAuthn needs the server to
--                        remember the random challenge it issued so the signed response
--                        can be checked against it. Kept in the DB rather than in memory
--                        because Render can restart or run more than one instance, and an
--                        in-memory challenge would then simply vanish mid sign-in.
--
-- Idempotent, safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_passkeys (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The credential id the authenticator generated, base64url. Globally unique: this is
  -- what an incoming assertion is looked up by during a passwordless sign-in, where the
  -- customer has not told us who they are yet.
  credential_id  TEXT NOT NULL UNIQUE,

  -- The credential's PUBLIC key, base64url of the COSE bytes. Not a secret. The private
  -- half never leaves the customer's device, which is the entire point: a database leak
  -- here hands an attacker nothing they can sign with.
  public_key     TEXT NOT NULL,

  -- Signature counter reported by the authenticator. If a replayed assertion ever arrives
  -- with a counter at or below the stored one, the credential has been cloned. Many modern
  -- passkeys always report 0 (they sync across devices), so a 0 counter is not a fault.
  counter        BIGINT NOT NULL DEFAULT 0,

  -- 'internal' (platform: Face ID, Windows Hello), 'usb', 'nfc', 'ble', 'hybrid' (phone
  -- used to sign in on a nearby laptop). Passed back to the browser so it can hint the
  -- right prompt instead of offering every option.
  transports     TEXT[] NOT NULL DEFAULT '{}',

  -- The Relying Party ID the credential was created under, e.g. 'triakar.com'. A passkey
  -- only works on the domain it was made on, so this is stored per row and every sign-in
  -- filters on it. Without this column a triakar.in credential would be offered on
  -- triakar.com and fail with an opaque browser error.
  rp_id          TEXT NOT NULL,

  -- What the customer sees in Settings, e.g. "iPhone" or "Windows laptop". Best-effort,
  -- read off the user agent at registration and editable later, so someone with three
  -- passkeys can tell which one to remove.
  device_label   TEXT NOT NULL DEFAULT 'Passkey',
  aaguid         TEXT,

  -- multiDevice means the passkey syncs (iCloud Keychain, Google Password Manager), so
  -- losing one device does not lock the account out. singleDevice means it does not.
  -- Shown in Settings so "remove this passkey" is an informed decision.
  device_type    TEXT NOT NULL DEFAULT 'singleDevice'
                   CHECK (device_type IN ('singleDevice','multiDevice')),
  backed_up      BOOLEAN NOT NULL DEFAULT false,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_passkeys_user_idx ON public.user_passkeys (user_id);
CREATE INDEX IF NOT EXISTS user_passkeys_rp_idx   ON public.user_passkeys (rp_id);

ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

-- Read-only for the owner. Every write (register, counter bump, delete) goes through the
-- backend on the service-role key, matching how the rest of the admin/API surface works,
-- so a stolen anon key cannot register a credential against someone else's account.
DROP POLICY IF EXISTS "own passkeys readable" ON public.user_passkeys;
CREATE POLICY "own passkeys readable" ON public.user_passkeys
  FOR SELECT USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge   TEXT NOT NULL,
  purpose     TEXT NOT NULL CHECK (purpose IN ('registration','authentication')),

  -- Set for registration (we already know who is adding a passkey). NULL for a
  -- passwordless sign-in, where the credential itself reveals the user afterwards.
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rp_id       TEXT NOT NULL,
  origin      TEXT NOT NULL,

  -- Single use. Marked the moment it is redeemed, so the same signed assertion cannot be
  -- replayed even inside the five-minute window.
  consumed_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webauthn_challenges_expiry_idx ON public.webauthn_challenges (expires_at);

-- Server-only by design: RLS on with no policies at all, so anon and authenticated see
-- nothing. Only the service-role key (which bypasses RLS) touches this table.
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
