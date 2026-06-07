import supabase from '../db/supabaseClient.js';

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
