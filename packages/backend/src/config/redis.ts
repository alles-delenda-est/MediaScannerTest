import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const redisUrl = env.REDIS_URL || `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`;

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis client error');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

export async function redisHealthCheck(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis connection closed');
}

// Create a separate connection for BullMQ (it requires a dedicated connection)
export function createBullMQConnection(): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
