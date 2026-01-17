import { app } from './app.js';
import { env, isDev } from './config/env.js';
import { logger } from './utils/logger.js';
import { closePool } from './config/database.js';
import { closeRedis } from './config/redis.js';
import { closeQueues, setupQueueEventListeners } from './jobs/queues.js';
import { initializeWorkers, closeAllWorkers } from './jobs/workers/index.js';
import { initializeScheduler, stopScheduler } from './jobs/scheduler.js';

const port = parseInt(env.PORT);

// Initialize background job system
const ENABLE_WORKERS = process.env.ENABLE_WORKERS !== 'false';

if (ENABLE_WORKERS) {
  setupQueueEventListeners();
  initializeWorkers();
  initializeScheduler();
  logger.info('Background job system initialized');
} else {
  logger.info('Background job system disabled (ENABLE_WORKERS=false)');
}

const server = app.listen(port, () => {
  logger.info({ port, env: env.NODE_ENV, workers: ENABLE_WORKERS }, '🚀 Server started');
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Received shutdown signal');

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Stop scheduler first
      if (ENABLE_WORKERS) {
        stopScheduler();
        await closeAllWorkers();
        await closeQueues();
      }

      await closePool();
      await closeRedis();
      logger.info('All connections closed');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught Exception');
  process.exit(1);
});
