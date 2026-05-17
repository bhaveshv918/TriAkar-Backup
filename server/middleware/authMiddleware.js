import supabase from '../db/supabaseClient.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised — no token provided' });
  }

  const token = header.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Unauthorised — invalid or expired token' });
  }

  req.user = user;
  next();
}
