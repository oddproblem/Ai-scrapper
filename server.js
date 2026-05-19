import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { logger } from './utils/logger.js';
import opportunityRoutes from './routes/opportunities.js';
import authRoutes from './routes/auth.js';
import { initCron } from './scheduler/cron.js';
import User from './models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security Middleware ──
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Rate Limiting ──
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
});
app.use('/api', limiter);

// ── Sessions ──
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 24 * 60 * 60,
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  })
);

// ── Passport ──
app.use(passport.initialize());
app.use(passport.session());

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            user = await User.create({
              googleId: profile.id,
              email: profile.emails[0].value,
              displayName: profile.displayName,
              avatar: profile.photos?.[0]?.value || '',
            });
            logger.info(`[Auth] New user registered: ${user.email}`);
          }
          done(null, user);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
  logger.info('[Auth] Google OAuth strategy configured');
} else {
  logger.warn('[Auth] Google OAuth keys not set — running in dev mode (no auth enforced)');
}

passport.serializeUser((user, done) => done(null, user.id || user._id));
passport.deserializeUser(async (id, done) => {
  try {
    if (id === 'dev-user') return done(null, { _id: 'dev-user', displayName: 'Developer', role: 'admin' });
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// ── Routes ──
app.use('/auth', authRoutes);
app.use('/api/opportunities', opportunityRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Serve React frontend in production
const clientDist = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Database + Start ──
async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info(`[DB] Connected to MongoDB`);

    // Initialize cron scheduler
    initCron();

    app.listen(PORT, () => {
      logger.info(`[Server] Running on http://localhost:${PORT}`);
      logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    logger.error(`[Server] Failed to start: ${err.message}`);
    process.exit(1);
  }
}

// ── Graceful Shutdown ──
const shutdown = async (signal) => {
  logger.info(`[Server] ${signal} received — shutting down gracefully`);
  await mongoose.connection.close();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();

export default app;
