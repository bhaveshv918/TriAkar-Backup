export function errorHandler(err, _req, res, _next) {
  // CORS rejections → opaque 403 (don't echo the origin back)
  if (err && err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: 'Access denied' });
  }

  console.error(`[TriAkar Error] ${err.message}`, err.stack);
  const status = err.status || err.statusCode || 500;

  // In production, never leak internal error messages / stack traces.
  const isProd = process.env.NODE_ENV === 'production';
  const message = isProd
    ? (status < 500 || status === 502 ? (err.message || 'Request failed') : 'Something went wrong')
    : (err.message || 'Internal server error');

  res.status(status).json({ error: message });
}
