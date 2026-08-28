import supabase from '../db/supabaseClient.js';

// FIX #4: was checking app_metadata.role which is never set anywhere.
// Now uses the same email-allowlist approach as productController.upsertProduct.
//
// Second gate, TOTP: Supabase stamps every access token with an `aal` claim,
// aal1 for a password-only session and aal2 once a 6-digit code has been verified
// (browser side in js/admin-mfa.js). Checking it here is what actually makes 2FA
// mean something, since a stolen password plus a direct call to this API would
// sail straight past any check that only lives in the admin panel's own JS.
//
// Conditional on purpose: nothing is enforced until the account really has a
// verified factor, so switching 2FA on cannot lock the owner out part way through
// enrolment, and accounts that never enrol are unaffected.

const BEARER = 'Bearer ';

function tokenClaims(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith(BEARER)) return null;
  const payload = header.slice(BEARER.length).split('.')[1];
  if (!payload) return null;
  // Safe to read without verifying: requireAuth already checked this exact token
  // against the auth server, so by the time we get here it is a real token.
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch (_) { return null; }
}

// getUser() usually returns the factor list inline. The admin API is only the
// fallback for when it does not, cached briefly so a burst of panel requests does
// not turn into a burst of lookups.
const FACTOR_TTL_MS = 60_000;
const factorCache = new Map();

async function hasVerifiedFactor(user) {
  if (!user?.id) return false;
  if (Array.isArray(user.factors)) return user.factors.some(f => f.status === 'verified');

  const hit = factorCache.get(user.id);
  if (hit && Date.now() - hit.at < FACTOR_TTL_MS) return hit.value;
  try {
    const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
    if (error) throw error;
    const list = Array.isArray(data) ? data : (data?.factors || []);
    const value = list.some(f => f.status === 'verified');
    factorCache.set(user.id, { value, at: Date.now() });
    return value;
  } catch (err) {
    // Deliberately fails open on a lookup error rather than taking the entire admin
    // panel offline for a Supabase hiccup. The email allowlist and the password are
    // both still standing, and this path is only reached when getUser() gave us no
    // factor list at all.
    console.warn('[requireAdmin] MFA factor lookup failed:', err.message);
    return false;
  }
}

export async function requireAdmin(req, res, next) {
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'bhaveshv918@gmail.com')
    .split(',').map(e => e.trim().toLowerCase());
  const email = (req.user?.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Forbidden, admin access required' });
  }

  if (await hasVerifiedFactor(req.user)) {
    const claims = tokenClaims(req);
    if (!claims || claims.aal !== 'aal2') {
      return res.status(403).json({
        error: 'Two-factor verification required. Sign in to the admin panel again and enter your code.',
        code: 'mfa_required',
      });
    }
  }

  next();
}
