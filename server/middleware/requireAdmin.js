export function requireAdmin(req, res, next) {
  if (req.user?.app_metadata?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden — admin access required' });
  }
  next();
}
