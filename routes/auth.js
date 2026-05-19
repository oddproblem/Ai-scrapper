import { Router } from 'express';
import passport from 'passport';
import User from '../models/User.js';
import { ensureAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /auth/google — Initiate Google OAuth flow
 */
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * GET /auth/google/callback — Google OAuth callback
 * After success, redirect to frontend with user token in URL
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/fail', session: false }),
  (req, res) => {
    const clientUrl = process.env.CLIENT_URL || '/';
    // Pass the user's MongoDB _id as token — frontend stores it
    res.redirect(`${clientUrl}?token=${req.user._id}`);
  }
);

/**
 * GET /auth/fail — OAuth failure
 */
router.get('/fail', (req, res) => {
  res.status(401).json({ error: 'Google authentication failed' });
});

/**
 * GET /auth/me — Get current user by token
 */
router.get('/me', async (req, res) => {
  // Dev mode — no OAuth configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.json({
      user: {
        _id: 'dev-user',
        displayName: 'Developer',
        email: 'dev@localhost',
        avatar: '',
        role: 'admin',
        alerts: { enabled: false, keywords: '', types: [], sources: [], frequency: 'daily' },
      },
      devMode: true,
    });
  }

  // Check for token in Authorization header
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ user: null });
  }

  try {
    const user = await User.findById(token).lean();
    if (!user) return res.status(401).json({ user: null });
    return res.json({ user, devMode: false });
  } catch {
    return res.status(401).json({ user: null });
  }
});

/**
 * GET /auth/alerts — Get current user's alert preferences
 */
router.get('/alerts', ensureAuth, async (req, res) => {
  try {
    const userId = req.userId;
    if (userId === 'dev-user') {
      const saved = await User.findOne({}).select('alerts').lean();
      return res.json(saved?.alerts || { enabled: false, keywords: '', types: [], sources: [], frequency: 'daily' });
    }
    const user = await User.findById(userId).select('alerts').lean();
    res.json(user?.alerts || { enabled: false, keywords: '', types: [], sources: [], frequency: 'daily' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get alert preferences' });
  }
});

/**
 * PUT /auth/alerts — Update current user's alert preferences
 */
router.put('/alerts', ensureAuth, async (req, res) => {
  try {
    const { enabled, keywords, types, sources, frequency } = req.body;
    const alerts = {
      enabled: !!enabled,
      keywords: keywords || '',
      types: Array.isArray(types) ? types : [],
      sources: Array.isArray(sources) ? sources : [],
      frequency: ['realtime', 'daily', 'weekly'].includes(frequency) ? frequency : 'daily',
    };

    const userId = req.userId;

    // Dev mode
    if (userId === 'dev-user') {
      let user = await User.findOne({});
      if (!user) {
        user = await User.create({
          googleId: 'dev-user',
          email: req.body.email || 'dev@localhost',
          displayName: 'Developer',
          alerts,
        });
      } else {
        user.alerts = alerts;
        if (req.body.email) user.email = req.body.email;
        await user.save();
      }
      return res.json({ message: 'Alert preferences saved', alerts: user.alerts });
    }

    const user = await User.findByIdAndUpdate(userId, { alerts }, { new: true });
    res.json({ message: 'Alert preferences saved', alerts: user.alerts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save alert preferences' });
  }
});

/**
 * POST /auth/logout — just a no-op since we use token auth
 */
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

export default router;
