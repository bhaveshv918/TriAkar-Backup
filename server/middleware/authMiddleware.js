import supabase from '../db/supabaseClient.js';

// Attaches req.user when a valid token is present, but never rejects the
// request for having none. For routes that should work for an anonymous
// first-time visitor (Instant Quote upload/pricing) while still identifying
// a logged-in customer when there is one.
export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  const token = header.split(' ')[1];
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) req.user = data.user;
  } catch (_) { /* treat as anonymous */ }
  next();
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised — no token provided' });
  }

  const token = header.split(' ')[1];
  try {
    const { data, error } = await supabase.auth.getUser(token);
    const user = data?.user;
    if (error || !user) {
      console.warn('[requireAuth] rejected —', error?.message || 'no user');
      return res.status(401).json({ error: 'Unauthorised — invalid or expired token' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('[requireAuth] threw unexpectedly:', err.message);
    return res.status(401).json({ error: 'Unauthorised — token verification failed' });
  }
}
