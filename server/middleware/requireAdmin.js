// FIX #4: was checking app_metadata.role which is never set anywhere.
// Now uses the same email-allowlist approach as productController.upsertProduct.
export function requireAdmin(req, res, next) {
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'bhaveshv918@gmail.com')
    .split(',').map(e => e.trim().toLowerCase());
  const email = (req.user?.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Forbidden — admin access required' });
  }
  next();
}
