/**
 * Auth middleware — skips enforcement when OAuth is not configured (dev mode).
 */
export function ensureAuth(req, res, next) {
  // If OAuth is not configured, allow all requests (dev mode)
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return next();
  }
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

export function ensureGuest(req, res, next) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return next();
  }
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}
