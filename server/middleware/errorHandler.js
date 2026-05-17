export function errorHandler(err, req, res, next) {
  console.error(`[TriAkar Error] ${err.message}`, err.stack);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}
