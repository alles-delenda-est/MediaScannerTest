import { Router } from 'express';
import passport from 'passport';
import { authenticate, generateToken } from '../middleware/auth.js';
import { env, isDev } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { UserRole } from '@media-scanner/shared';

export const router = Router();

interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: UserRole;
}

// GET /api/auth/me - Get current user
router.get('/me', authenticate, (req, res) => {
  res.json({ data: req.user });
});

// GET /api/auth/google - Initiate Google OAuth
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account', // Always show account picker
  })
);

// GET /api/auth/google/callback - Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login?error=unauthorized',
  }),
  (req, res) => {
    try {
      const user = req.user as AuthenticatedUser;

      if (!user) {
        logger.warn('OAuth callback without user');
        return res.redirect('/login?error=no_user');
      }

      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      // Set token as HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: !isDev, // HTTPS only in production
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      logger.info({ userId: user.id, email: user.email }, 'User logged in via Google OAuth');

      // Redirect to frontend
      const frontendUrl = isDev ? 'http://localhost:5173' : env.API_BASE_URL;
      res.redirect(`${frontendUrl}/dashboard`);
    } catch (error) {
      logger.error({ error }, 'Error in OAuth callback');
      res.redirect('/login?error=server_error');
    }
  }
);

// GET /api/auth/failure - OAuth failure handler
router.get('/failure', (req, res) => {
  const message = req.query.message || 'Authentification échouée';
  res.status(401).json({
    error: {
      code: 'AUTH_FAILED',
      message: message as string,
    },
  });
});

// POST /api/auth/logout - Logout
router.post('/logout', authenticate, (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: !isDev,
    sameSite: 'lax',
  });

  logger.info({ userId: req.user?.id }, 'User logged out');
  res.json({ data: { message: 'Déconnexion réussie' } });
});

// GET /api/auth/logout - Logout via GET (for convenience)
router.get('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: !isDev,
    sameSite: 'lax',
  });

  const frontendUrl = isDev ? 'http://localhost:5173' : env.API_BASE_URL;
  res.redirect(`${frontendUrl}/login`);
});
