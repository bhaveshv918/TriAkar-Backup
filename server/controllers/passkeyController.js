/* TriAkar : passkey (WebAuthn) endpoints
 *
 * Four ceremonies, two of them public:
 *   register/options + register/verify   add a passkey to the account you are signed in as
 *   login/options    + login/verify      sign in with no email and no password at all
 * plus list / rename / delete for the Settings tab.
 *
 * Design notes worth keeping in view when changing this file:
 *
 * 1. Sign-in is discoverable-credential only. The browser is never told which credentials
 *    exist for an email, because there is no email in the request at all: the customer
 *    picks a passkey from their own device's list and the credential id tells US who they
 *    are. That removes the account-enumeration hole that an "is there a passkey for
 *    this address?" endpoint would open.
 *
 * 2. A passkey never becomes the session. Verification only proves identity; the session
 *    handed back is an ordinary Supabase one, so RLS, requireAuth and token refresh are
 *    untouched by any of this.
 *
 * 3. Registration is gated behind requireAuth, so adding a passkey always requires an
 *    already-proven session. There is no "register a passkey for this email" path an
 *    attacker could aim at somebody else's account.
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

import supabase from '../db/supabaseClient.js';
import {
  RP_NAME,
  resolveRp,
  bytesToB64url,
  b64urlToBytes,
  deviceLabelFrom,
  storeChallenge,
  consumeChallenge,
  mintSessionForEmail,
} from '../services/webauthn.js';

/* What the browser and the Settings tab are allowed to see about a credential. The public
 * key and the raw credential id stay on the server: neither is a secret exactly, but
 * neither has any business being in a page either. */
function publicShape(row) {
  return {
    id:           row.id,
    device_label: row.device_label,
    device_type:  row.device_type,
    backed_up:    row.backed_up,
    created_at:   row.created_at,
    last_used_at: row.last_used_at,
  };
}

/* ── POST /api/auth/passkeys/register/options ─────────────── */
export async function registerOptions(req, res, next) {
  try {
    const { rpID, origin } = resolveRp(req);
    const user = req.user;

    // Existing credentials on this domain, so the same phone cannot be enrolled twice and
    // end up as two identical-looking rows in Settings.
    const { data: existing } = await supabase
      .from('user_passkeys')
      .select('credential_id, transports')
      .eq('user_id', user.id)
      .eq('rp_id', rpID);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email || 'TriAkar customer',
      userDisplayName: user.user_metadata?.full_name || user.email || 'TriAkar customer',
      attestationType: 'none',   // we do not need to know the make of the authenticator
      excludeCredentials: (existing || []).map(c => ({
        id: c.credential_id,
        transports: c.transports || undefined,
      })),
      authenticatorSelection: {
        // Discoverable ("resident") is required, not preferred, on purpose. A
        // non-discoverable credential cannot be used for a passwordless sign-in, so
        // accepting one would create a passkey that silently never works. Better to fail
        // loudly here, on a device that cannot store one, than at sign-in later.
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'preferred',
      },
    });

    const challengeId = await storeChallenge({
      challenge: options.challenge,
      purpose: 'registration',
      userId: user.id,
      rpID,
      origin,
    });

    res.json({ challengeId, options });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

/* ── POST /api/auth/passkeys/register/verify ──────────────── */
export async function registerVerify(req, res, next) {
  try {
    const { rpID, origins } = resolveRp(req);
    const user = req.user;
    const { challengeId, response, label } = req.body || {};
    if (!response) return res.status(400).json({ error: 'Missing passkey response.' });

    const challenge = await consumeChallenge({
      challengeId, purpose: 'registration', rpID, userId: user.id,
    });

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        // The session already proved who this is, so a device that skipped the biometric
        // prompt is not a reason to refuse the enrolment. Sign-in is where user
        // verification is actually enforced (see loginOptions).
        requireUserVerification: false,
      });
    } catch (verifyErr) {
      return res.status(400).json({ error: verifyErr.message || 'Could not verify this passkey.' });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Could not verify this passkey.' });
    }

    const info = verification.registrationInfo;
    const cred = info.credential;
    const transports = cred.transports || [];

    const { data: row, error } = await supabase
      .from('user_passkeys')
      .insert({
        user_id:       user.id,
        credential_id: cred.id,
        public_key:    bytesToB64url(cred.publicKey),
        counter:       cred.counter || 0,
        transports,
        rp_id:         rpID,
        device_label:  (label && String(label).trim().slice(0, 40))
                         || deviceLabelFrom(req.headers['user-agent'], transports),
        aaguid:        info.aaguid || null,
        device_type:   info.credentialDeviceType || 'singleDevice',
        backed_up:     Boolean(info.credentialBackedUp),
      })
      .select('*')
      .single();

    // 23505 is Postgres' unique violation: this exact credential is already on file. That
    // is not really an error from the customer's point of view, they just re-added the
    // same device, so say so plainly instead of returning a 500.
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'This device already has a passkey for your account.' });
      throw error;
    }

    res.json({ passkey: publicShape(row) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

/* ── POST /api/auth/passkeys/login/options ────────────────── */
export async function loginOptions(req, res, next) {
  try {
    const { rpID, origin } = resolveRp(req);

    const options = await generateAuthenticationOptions({
      rpID,
      // Deliberately empty: see the discoverable-credential note at the top of this file.
      allowCredentials: [],
      // The passkey is the only factor here, so the device must actually check that its
      // owner is present (Face ID, fingerprint, PIN). Possession of an unlocked phone
      // alone is not enough to sign in as somebody.
      userVerification: 'required',
    });

    const challengeId = await storeChallenge({
      challenge: options.challenge,
      purpose: 'authentication',
      rpID,
      origin,
    });

    res.json({ challengeId, options });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

/* ── POST /api/auth/passkeys/login/verify ─────────────────── */
export async function loginVerify(req, res, next) {
  try {
    const { rpID, origins } = resolveRp(req);
    const { challengeId, response } = req.body || {};
    if (!response || !response.id) return res.status(400).json({ error: 'Missing passkey response.' });

    const challenge = await consumeChallenge({ challengeId, purpose: 'authentication', rpID });

    const { data: cred, error: credErr } = await supabase
      .from('user_passkeys')
      .select('*')
      .eq('credential_id', response.id)
      .eq('rp_id', rpID)
      .maybeSingle();
    if (credErr) throw credErr;
    if (!cred) return res.status(401).json({ error: 'This passkey is not registered with TriAkar.' });

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        credential: {
          id:         cred.credential_id,
          publicKey:  b64urlToBytes(cred.public_key),
          counter:    Number(cred.counter) || 0,
          transports: cred.transports || undefined,
        },
        requireUserVerification: true,
      });
    } catch (verifyErr) {
      // Also the path a cloned-authenticator counter regression takes, which the library
      // raises as a normal verification failure.
      return res.status(401).json({ error: verifyErr.message || 'Could not verify this passkey.' });
    }

    if (!verification.verified) return res.status(401).json({ error: 'Could not verify this passkey.' });

    const { data: authUser, error: userErr } = await supabase.auth.admin.getUserById(cred.user_id);
    if (userErr || !authUser?.user?.email) {
      return res.status(401).json({ error: 'The account behind this passkey is no longer available.' });
    }
    const email = authUser.user.email;

    const session = await mintSessionForEmail(email);

    // Counter and last-used are recorded after the session succeeds, so a failure to mint
    // does not leave a credential looking used when nobody actually got in.
    await supabase
      .from('user_passkeys')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', cred.id);

    // Same envelope as POST /api/auth/login, so the frontend stores the session through
    // exactly one code path regardless of how the customer signed in.
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_code')
      .eq('id', cred.user_id)
      .maybeSingle();
    const user_code = profile?.user_code || null;

    res.json({
      access_token:  session.access_token,
      refresh_token: session.refresh_token,
      expires_in:    session.expires_in,
      user:          Object.assign({}, session.user, { user_code }),
      user_code,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

/* ── GET /api/auth/passkeys ───────────────────────────────── */
export async function listPasskeys(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('user_passkeys')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ passkeys: (data || []).map(publicShape) });
  } catch (err) { next(err); }
}

/* ── PATCH /api/auth/passkeys/:id ─────────────────────────── */
export async function renamePasskey(req, res, next) {
  try {
    const label = String(req.body?.label || '').trim().slice(0, 40);
    if (!label) return res.status(400).json({ error: 'Please give this passkey a name.' });

    // Scoped by user_id as well as id, so an id from someone else's account matches nothing.
    const { data, error } = await supabase
      .from('user_passkeys')
      .update({ device_label: label })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Passkey not found.' });
    res.json({ passkey: publicShape(data) });
  } catch (err) { next(err); }
}

/* ── DELETE /api/auth/passkeys/:id ────────────────────────── */
export async function deletePasskey(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('user_passkeys')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Passkey not found.' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
}
