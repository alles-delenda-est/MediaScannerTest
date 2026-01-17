import { Queue, QueueEvents } from 'bullmq';
import { createBullMQConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';

const connection = createBullMQConnection();

// Queue names
export const QUEUE_NAMES = {
  RSS_SCAN: 'rss-scan',
  SOCIAL_SCAN: 'social-scan',
  AI_ANALYSIS: 'ai-analysis',
  POST_GENERATION: 'post-generation',
  DAILY_SUMMARY: 'daily-summary',
  SCAN_ORCHESTRATOR: 'scan-orchestrator',
} as const;

// Create queues
export const queues = {
  rssScan: new Queue(QUEUE_NAMES.RSS_SCAN, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  }),

  socialScan: new Queue(QUEUE_NAMES.SOCIAL_SCAN, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  }),

  aiAnalysis: new Queue(QUEUE_NAMES.AI_ANALYSIS, {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    },
  }),

  postGeneration: new Queue(QUEUE_NAMES.POST_GENERATION, {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    },
  }),

  dailySummary: new Queue(QUEUE_NAMES.DAILY_SUMMARY, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: { count: 30 },
      removeOnFail: { count: 100 },
    },
  }),

  scanOrchestrator: new Queue(QUEUE_NAMES.SCAN_ORCHESTRATOR, {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    },
  }),
};

// Queue events for monitoring
export const queueEvents = {
  aiAnalysis: new QueueEvents(QUEUE_NAMES.AI_ANALYSIS, { connection }),
  postGeneration: new QueueEvents(QUEUE_NAMES.POST_GENERATION, { connection }),
};

// Setup queue event listeners
export function setupQueueEventListeners() {
  queueEvents.aiAnalysis.on('completed', ({ jobId }) => {
    logger.debug({ jobId, queue: QUEUE_NAMES.AI_ANALYSIS }, 'Job completed');
  });

  queueEvents.aiAnalysis.on('failed', ({ jobId, failedReason }) => {
    logger.error({ jobId, queue: QUEUE_NAMES.AI_ANALYSIS, reason: failedReason }, 'Job failed');
  });

  queueEvents.postGeneration.on('completed', ({ jobId }) => {
    logger.debug({ jobId, queue: QUEUE_NAMES.POST_GENERATION }, 'Job completed');
  });

  queueEvents.postGeneration.on('failed', ({ jobId, failedReason }) => {
    logger.error({ jobId, queue: QUEUE_NAMES.POST_GENERATION, reason: failedReason }, 'Job failed');
  });
}

// Job data types
export interface RssScanJobData {
  sourceId: string;
  feedUrl: string;
  sourceName: string;
}

export interface SocialScanJobData {
  platform: 'twitter' | 'mastodon' | 'bluesky';
  query?: string;
  accountId?: string;
}

export interface AiAnalysisJobData {
  articleId: string;
  title: string;
  lede: string;
  sourceName: string;
  url: string;
  topicIds?: string[]; // IDs of topics to analyze against
}

export interface PostGenerationJobData {
  articleId: string;
  title: string;
  lede: string;
  url: string;
  relevanceReasoning: string;
  potentialAngle: string;
  sourceName: string;
}

export interface DailySummaryJobData {
  date: string;
}

export interface ScanOrchestratorJobData {
  type: 'full' | 'incremental' | 'cleanup';
  triggeredBy: 'scheduler' | 'manual';
  sourceId?: string;
}

// Helper to add jobs to queues
export async function addAiAnalysisJob(data: AiAnalysisJobData) {
  return queues.aiAnalysis.add('analyze-article', data, {
    priority: 1,
  });
}

export async function addPostGenerationJob(data: PostGenerationJobData) {
  return queues.postGeneration.add('generate-posts', data, {
    priority: 2,
  });
}

export async function addDailySummaryJob(date: string) {
  return queues.dailySummary.add('generate-summary', { date }, {
    jobId: `summary-${date}`, // Prevent duplicate jobs for same date
  });
}

export async function addScanJob(data: ScanOrchestratorJobData) {
  return queues.scanOrchestrator.add(`scan-${data.type}`, data);
}

// Get queue stats
export async function getQueueStats() {
  const stats = await Promise.all([
    queues.aiAnalysis.getJobCounts(),
    queues.postGeneration.getJobCounts(),
    queues.rssScan.getJobCounts(),
    queues.dailySummary.getJobCounts(),
  ]);

  return {
    aiAnalysis: stats[0],
    postGeneration: stats[1],
    rssScan: stats[2],
    dailySummary: stats[3],
  };
}

// Cleanup all queues
export async function closeQueues() {
  await Promise.all([
    queues.rssScan.close(),
    queues.socialScan.close(),
    queues.aiAnalysis.close(),
    queues.postGeneration.close(),
    queues.dailySummary.close(),
    queues.scanOrchestrator.close(),
    queueEvents.aiAnalysis.close(),
    queueEvents.postGeneration.close(),
  ]);

  logger.info('All queues closed');
}
