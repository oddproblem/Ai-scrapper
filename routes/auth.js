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
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect(process.env.CLIENT_URL || '/');
  }
);

/**
 * GET /auth/me — Get current user
 */
router.get('/me', (req, res) => {
  // If OAuth isn't configured, return a dev user
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

  if (req.isAuthenticated()) {
    return res.json({ user: req.user, devMode: false });
  }
  res.status(401).json({ user: null });
});

/**
 * GET /auth/alerts — Get current user's alert preferences
 */
router.get('/alerts', ensureAuth, async (req, res) => {
  try {
    // Dev mode
    if (!process.env.GOOGLE_CLIENT_ID) {
      const saved = await User.findOne({}).select('alerts').lean();
      return res.json(saved?.alerts || { enabled: false, keywords: '', types: [], sources: [], frequency: 'daily' });
    }
    const user = await User.findById(req.user._id).select('alerts').lean();
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

    // Dev mode — update or create first user
    if (!process.env.GOOGLE_CLIENT_ID) {
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

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { alerts },
      { new: true }
    );
    res.json({ message: 'Alert preferences saved', alerts: user.alerts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save alert preferences' });
  }
});

/**
 * POST /auth/logout
 */
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    req.session?.destroy?.();
    res.json({ message: 'Logged out' });
  });
});

export default router;
