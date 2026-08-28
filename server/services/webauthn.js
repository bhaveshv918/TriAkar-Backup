/* TriAkar : WebAuthn (passkey) plumbing
 *
 * Everything here is the boring-but-critical half of passkeys: working out which domain
 * the request came from, turning bytes into text the database can hold, giving a new
 * credential a name a human recognises, and turning a verified signature into a real
 * Supabase session.
 *
 * The interesting half (signature verification, attestation parsing) is deliberately NOT
 * hand-rolled. It lives in @simplewebauthn/server, which is the reference implementation
 * for Node. Writing our own CBOR and COSE parsing here would be the single easiest place
 * in this codebase to introduce a silent authentication bypass.
 */

import supabase, { createSignInClient } from '../db/supabaseClient.js';

export const RP_NAME = 'TriAkar';

/* A passkey is welded to one Relying Party ID, and the browser will only hand it back on
 * an origin that the RP ID is a suffix of. So triakar.com and www.triakar.com share their
 * passkeys, while triakar.in is a genuinely separate domain and gets its own.
 *
 * Anything not on this list is rejected rather than guessed at. Deriving the RP ID from
 * whatever Origin header arrived would let an attacker's page register a credential under
 * a domain we do not control. */
const RP_ORIGINS = {
  'triakar.com':       ['https://triakar.com', 'https://www.triakar.com'],
  'triakar.in':        ['https://triakar.in', 'https://www.triakar.in'],
  'triakar.vercel.app': ['https://triakar.vercel.app'],
  // WebAuthn treats localhost as a secure origin, so passkeys work in local dev without
  // TLS. 127.0.0.1 is deliberately absent: an RP ID has to be a domain, never an IP, so
  // passkeys simply cannot work there. Use http://localhost:PORT when testing.
  'localhost':         ['http://localhost:3000', 'http://localhost:5500', 'http://localhost:8123'],
};

// FRONTEND_URL is the deploy's canonical site. Fold it in so a preview or a future domain
// works without a code change, as long as it is a real https origin.
if (process.env.FRONTEND_URL) {
  try {
    const u = new URL(process.env.FRONTEND_URL);
    const host = u.hostname;
    const rpID = host.startsWith('www.') ? host.slice(4) : host;
    if (!RP_ORIGINS[rpID]) RP_ORIGINS[rpID] = [];
    if (!RP_ORIGINS[rpID].includes(u.origin)) RP_ORIGINS[rpID].push(u.origin);
  } catch (_) { /* malformed FRONTEND_URL, the static list above still applies */ }
}

/* Which domain is this request speaking for?
 * Returns { rpID, origins } where origins is every origin that shares those passkeys,
 * because the browser may send either the apex or the www form. Throws if the caller is
 * not a known TriAkar origin. */
export function resolveRp(req) {
  let origin = req.headers.origin || '';
  if (!origin && req.headers.referer) {
    try { origin = new URL(req.headers.referer).origin; } catch (_) { /* leave blank */ }
  }
  for (const [rpID, origins] of Object.entries(RP_ORIGINS)) {
    if (origins.includes(origin)) return { rpID, origins, origin };
  }
  const err = new Error('Passkeys are not available on this address.');
  err.status = 400;
  throw err;
}

/* ── byte <-> text ────────────────────────────────────────────
 * Public keys and credential ids are raw bytes. Postgres holds them as base64url text,
 * which is also the exact form WebAuthn uses on the wire, so nothing is re-encoded twice. */
export function bytesToB64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}
export function b64urlToBytes(str) {
  return new Uint8Array(Buffer.from(str, 'base64url'));
}

/* A name the customer will recognise in Settings six months from now. Best-effort only:
 * the user agent is a hint, not a fact, and the label is editable afterwards. */
export function deviceLabelFrom(userAgent = '', transports = []) {
  const ua = String(userAgent);
  if (transports.includes('usb') || transports.includes('nfc')) return 'Security key';
  if (/iPhone/i.test(ua))            return 'iPhone';
  if (/iPad/i.test(ua))              return 'iPad';
  if (/Macintosh|Mac OS X/i.test(ua))return 'Mac';
  if (/Android/i.test(ua))           return 'Android phone';
  if (/Windows/i.test(ua))           return 'Windows device';
  if (/Linux/i.test(ua))             return 'Linux device';
  return 'Passkey';
}

/* ── challenge store ──────────────────────────────────────────
 * WebAuthn is a challenge-response protocol: the response is only meaningful against the
 * exact random challenge this server issued. Held in Postgres rather than memory because
 * Render restarts and scales, and an in-memory challenge would disappear halfway through
 * someone's sign-in. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function storeChallenge({ challenge, purpose, userId = null, rpID, origin }) {
  // Opportunistic sweep. Cheaper and more reliable than a cron for a table that stays tiny.
  try {
    await supabase.from('webauthn_challenges').delete().lt('expires_at', new Date().toISOString());
  } catch (_) { /* housekeeping only, never block a sign-in on it */ }

  const { data, error } = await supabase
    .from('webauthn_challenges')
    .insert({
      challenge,
      purpose,
      user_id: userId,
      rp_id: rpID,
      origin,
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/* Redeems a challenge: it must exist, match the purpose and domain, be unexpired, and be
 * unused. Marked consumed before the signature is even checked, so a replayed response
 * cannot ride the same challenge twice. */
export async function consumeChallenge({ challengeId, purpose, rpID, userId = null }) {
  const fail = (msg) => { const e = new Error(msg); e.status = 400; throw e; };
  if (!challengeId || typeof challengeId !== 'string') fail('This sign-in attempt expired. Please try again.');

  const { data: row, error } = await supabase
    .from('webauthn_challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();
  if (error) throw error;

  if (!row)                                  fail('This sign-in attempt expired. Please try again.');
  if (row.consumed_at)                       fail('This sign-in attempt was already used. Please try again.');
  if (row.purpose !== purpose)               fail('This sign-in attempt is not valid. Please try again.');
  if (row.rp_id !== rpID)                    fail('This sign-in attempt is not valid on this address.');
  if (new Date(row.expires_at) <= new Date())fail('This sign-in attempt expired. Please try again.');
  if (userId && row.user_id !== userId)      fail('This sign-in attempt belongs to a different account.');

  await supabase
    .from('webauthn_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id);

  return row;
}

/* ── minting a session ────────────────────────────────────────
 * A verified passkey proves who the customer is; it does not, by itself, produce a token
 * the rest of TriAkar understands. Everything downstream (RLS, requireAuth, cart merge,
 * token refresh) runs on a normal Supabase session, so that is what we hand back.
 *
 * admin.generateLink mints a one-time magic-link token WITHOUT sending an email, and
 * verifyOtp immediately redeems it for an access/refresh pair. The token never leaves this
 * process. Net effect: identical to a password login, minus the password. */
export async function mintSessionForEmail(email) {
  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr) throw linkErr;

  const hashedToken = link?.properties?.hashed_token;
  if (!hashedToken) throw new Error('Could not start a session for this account.');

  // Throwaway client: never the shared service-role one, whose in-memory session must stay
  // service-role or every later .from() query silently drops to the signed-in user's RLS.
  const signIn = createSignInClient();
  const { data, error } = await signIn.auth.verifyOtp({
    token_hash: hashedToken,
    type: 'magiclink',
  });
  if (error) throw error;
  if (!data?.session) throw new Error('Could not start a session for this account.');
  return data.session;
}
