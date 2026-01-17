import { config } from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (4 levels up from config/)
const rootDir = path.resolve(__dirname, '../../../../');
config({ path: path.join(rootDir, '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_URL: z.string().optional(),

  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Session
  SESSION_SECRET: z.string(),

  // OAuth
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:3001/api/auth/google/callback'),

  // Claude API
  ANTHROPIC_API_KEY: z.string(),

  // Social APIs (optional)
  TWITTER_BEARER_TOKEN: z.string().optional(),
  BLUESKY_IDENTIFIER: z.string().optional(),
  BLUESKY_PASSWORD: z.string().optional(),

  // Domain restriction for OAuth (optional, defaults to partiliberalfrancais.fr)
  ALLOWED_EMAIL_DOMAIN: z.string().optional(),

  // API
  API_BASE_URL: z.string().default('http://localhost:3001'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
