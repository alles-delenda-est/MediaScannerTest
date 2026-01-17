import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { env } from './env.js';
import { query } from './database.js';
import { logger } from '../utils/logger.js';
import type { UserRole } from '@media-scanner/shared';

// Allowed email domain (without @)
const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'partiliberalfrancais.fr';

interface DbUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: UserRole;
  provider: string;
  provider_id: string;
}

export function isEmailAllowed(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === ALLOWED_DOMAIN.toLowerCase();
}

async function findOrCreateUser(profile: Profile): Promise<DbUser> {
  const email = profile.emails?.[0]?.value;

  if (!email) {
    throw new Error('No email provided by Google');
  }

  // Check if user exists
  const existingUser = await query<DbUser>(
    'SELECT * FROM users WHERE provider = $1 AND provider_id = $2',
    ['google', profile.id]
  );

  if (existingUser.rows.length > 0) {
    // Update last login
    await query(
      'UPDATE users SET last_login_at = NOW(), name = $1, avatar_url = $2 WHERE id = $3',
      [profile.displayName, profile.photos?.[0]?.value || null, existingUser.rows[0].id]
    );
    return existingUser.rows[0];
  }

  // Check if email already exists with different provider
  const existingEmail = await query<DbUser>(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (existingEmail.rows.length > 0) {
    // Link to existing account
    await query(
      'UPDATE users SET provider = $1, provider_id = $2, last_login_at = NOW() WHERE id = $3',
      ['google', profile.id, existingEmail.rows[0].id]
    );
    return existingEmail.rows[0];
  }

  // Create new user
  const result = await query<DbUser>(
    `INSERT INTO users (email, name, avatar_url, provider, provider_id, role, last_login_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [
      email,
      profile.displayName,
      profile.photos?.[0]?.value || null,
      'google',
      profile.id,
      'user', // Default role
    ]
  );

  logger.info({ email, userId: result.rows[0].id }, 'New user created via Google OAuth');
  return result.rows[0];
}

export function initializePassport(): void {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(null, false, { message: 'Aucun email fourni par Google' });
          }

          // Check domain restriction
          if (!isEmailAllowed(email)) {
            logger.warn({ email }, 'Login attempt from unauthorized domain');
            return done(null, false, {
              message: `Seuls les emails @${ALLOWED_DOMAIN} sont autorisés`
            });
          }

          const user = await findOrCreateUser(profile);
          return done(null, user);
        } catch (error) {
          logger.error({ error }, 'Google OAuth error');
          return done(error as Error);
        }
      }
    )
  );

  // Serialize user to session (we use JWT, so minimal serialization)
  passport.serializeUser((user, done) => {
    done(null, (user as DbUser).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const result = await query<DbUser>('SELECT * FROM users WHERE id = $1', [id]);
      done(null, result.rows[0] || null);
    } catch (error) {
      done(error);
    }
  });

  logger.info({ allowedDomain: ALLOWED_DOMAIN }, 'Passport initialized with Google OAuth');
}
