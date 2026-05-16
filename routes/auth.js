import { Router } from 'express';
import passport from 'passport';

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
 * POST /auth/logout
 */
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    req.session.destroy();
    res.json({ message: 'Logged out' });
  });
});

export default router;
