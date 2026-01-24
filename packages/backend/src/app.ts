import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { rateLimit } from 'express-rate-limit';
import { env, isDev } from './config/env.js';
import { initializePassport } from './config/passport.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { healthCheck } from './config/database.js';
import { redisHealthCheck } from './config/redis.js';
import { router as authRoutes } from './routes/auth.routes.js';
import { router as articlesRoutes } from './routes/articles.routes.js';
import { router as postsRoutes } from './routes/posts.routes.js';
import { router as sourcesRoutes } from './routes/sources.routes.js';
import { router as scansRoutes } from './routes/scans.routes.js';
import { router as dashboardRoutes } from './routes/dashboard.routes.js';
import { router as topicsRoutes } from './routes/topics.routes.js';

export const app: Express = express(); // Explicitly add ': Express'

// Security middleware
app.use(helmet());
app.use(cors({
  origin: isDev ? ['http://localhost:5173', 'http://localhost:3000'] : env.API_BASE_URL,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de requêtes, réessayez plus tard',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Initialize Passport for Google OAuth
initializePassport();
app.use(passport.initialize());

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', async (_req, res) => {
  const dbHealthy = await healthCheck();
  const redisHealthy = await redisHealthCheck();

  const status = dbHealthy && redisHealthy ? 'healthy' : 'unhealthy';
  const statusCode = status === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'up' : 'down',
      redis: redisHealthy ? 'up' : 'down',
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/articles', articlesRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/sources', sourcesRoutes);
app.use('/api/scans', scansRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/topics', topicsRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route non trouvée',
    },
  });
});

// Error handler
app.use(errorHandler);
