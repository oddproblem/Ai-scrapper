import User from '../models/User.js';

/**
 * Auth middleware — checks for Bearer token or dev mode.
 */
export async function ensureAuth(req, res, next) {
  // Dev mode — no OAuth configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    req.userId = 'dev-user';
    return next();
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = await User.findById(token).select('_id').lean();
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    req.userId = user._id.toString();
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required' });
  }
}

export function ensureGuest(req, res, next) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return next();
  }
  next();
}
