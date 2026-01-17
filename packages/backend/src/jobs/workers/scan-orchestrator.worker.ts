import { Worker, Job } from 'bullmq';
import { createBullMQConnection } from '../../config/redis.js';
import { queues, QUEUE_NAMES, type ScanOrchestratorJobData, type RssScanJobData } from '../queues.js';
import { SourceRepository } from '../../repositories/source.repository.js';
import { ArticleRepository } from '../../repositories/article.repository.js';
import { query } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

const connection = createBullMQConnection();
const sourceRepo = new SourceRepository();
const articleRepo = new ArticleRepository();

interface OrchestratorResult {
  type: string;
  sourcesProcessed: number;
  jobsQueued: number;
  errors: string[];
}

async function processScanOrchestrator(
  job: Job<ScanOrchestratorJobData>
): Promise<OrchestratorResult> {
  const { type, triggeredBy, sourceId } = job.data;

  logger.info({ type, triggeredBy, sourceId, jobId: job.id }, 'Processing scan orchestrator job');

  const errors: string[] = [];
  let sourcesProcessed = 0;
  let jobsQueued = 0;

  try {
    switch (type) {
      case 'full':
        // Full scan: process all active RSS sources
        const fullResult = await runFullScan(job);
        sourcesProcessed = fullResult.sourcesProcessed;
        jobsQueued = fullResult.jobsQueued;
        errors.push(...fullResult.errors);
        break;

      case 'incremental':
        // Incremental scan: only sources due for refresh
        const incrementalResult = await runIncrementalScan(job, sourceId);
        sourcesProcessed = incrementalResult.sourcesProcessed;
        jobsQueued = incrementalResult.jobsQueued;
        errors.push(...incrementalResult.errors);
        break;

      case 'cleanup':
        // Cleanup: remove old data
        const cleanupResult = await runCleanup(job);
        sourcesProcessed = cleanupResult.itemsDeleted;
        break;

      default:
        throw new Error(`Unknown scan type: ${type}`);
    }

    logger.info({
      type,
      sourcesProcessed,
      jobsQueued,
      errors: errors.length,
    }, 'Scan orchestration completed');

    return {
      type,
      sourcesProcessed,
      jobsQueued,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ type, error: errorMsg }, 'Scan orchestration failed');
    throw error;
  }
}

async function runFullScan(job: Job): Promise<{
  sourcesProcessed: number;
  jobsQueued: number;
  errors: string[];
}> {
  const errors: string[] = [];

  // Get all active RSS sources
  const sources = await sourceRepo.findActiveRssSources();

  logger.info({ count: sources.length }, 'Starting full scan of all RSS sources');

  let jobsQueued = 0;

  // Queue scan jobs for each source
  for (const source of sources) {
    try {
      const jobData: RssScanJobData = {
        sourceId: source.id,
        feedUrl: source.url,
        sourceName: source.name,
      };

      await queues.rssScan.add(`scan-${source.slug}`, jobData, {
        priority: source.category === 'national' ? 1 : 2,
      });

      jobsQueued++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to queue ${source.name}: ${errorMsg}`);
    }

    // Update progress
    job.updateProgress(Math.round((jobsQueued / sources.length) * 100));
  }

  return {
    sourcesProcessed: sources.length,
    jobsQueued,
    errors,
  };
}

async function runIncrementalScan(
  job: Job,
  specificSourceId?: string
): Promise<{
  sourcesProcessed: number;
  jobsQueued: number;
  errors: string[];
}> {
  const errors: string[] = [];

  // If a specific source is requested, only scan that one
  if (specificSourceId) {
    const source = await sourceRepo.findById(specificSourceId);

    if (!source) {
      throw new Error(`Source not found: ${specificSourceId}`);
    }

    const jobData: RssScanJobData = {
      sourceId: source.id,
      feedUrl: source.url,
      sourceName: source.name,
    };

    await queues.rssScan.add(`scan-${source.slug}`, jobData);

    return {
      sourcesProcessed: 1,
      jobsQueued: 1,
      errors: [],
    };
  }

  // Otherwise, find sources due for refresh based on their fetch interval
  const result = await query<{
    id: string;
    name: string;
    slug: string;
    url: string;
    category: string;
  }>(
    `SELECT id, name, slug, url, category
     FROM sources
     WHERE type = 'rss'
       AND is_active = true
       AND (
         last_fetched_at IS NULL
         OR last_fetched_at < NOW() - (fetch_interval_minutes || ' minutes')::INTERVAL
       )
     ORDER BY
       CASE WHEN last_fetched_at IS NULL THEN 0 ELSE 1 END,
       last_fetched_at ASC
     LIMIT 20`
  );

  const sources = result.rows;

  logger.info({ count: sources.length }, 'Starting incremental scan of due sources');

  let jobsQueued = 0;

  for (const source of sources) {
    try {
      const jobData: RssScanJobData = {
        sourceId: source.id,
        feedUrl: source.url,
        sourceName: source.name,
      };

      await queues.rssScan.add(`scan-${source.slug}`, jobData, {
        priority: source.category === 'national' ? 1 : 2,
      });

      jobsQueued++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to queue ${source.name}: ${errorMsg}`);
    }

    job.updateProgress(Math.round((jobsQueued / sources.length) * 100));
  }

  return {
    sourcesProcessed: sources.length,
    jobsQueued,
    errors,
  };
}

async function runCleanup(job: Job): Promise<{ itemsDeleted: number }> {
  logger.info('Starting cleanup of old data');

  let totalDeleted = 0;

  // Delete articles older than 90 days that are not relevant
  const articlesResult = await query(
    `DELETE FROM articles
     WHERE status IN ('irrelevant', 'error')
       AND created_at < NOW() - INTERVAL '90 days'`
  );
  totalDeleted += articlesResult.rowCount || 0;

  job.updateProgress(33);

  // Delete old scan logs (keep last 30 days)
  const logsResult = await query(
    `DELETE FROM scan_logs
     WHERE started_at < NOW() - INTERVAL '30 days'`
  );
  totalDeleted += logsResult.rowCount || 0;

  job.updateProgress(66);

  // Delete old daily summaries (keep last 90 days)
  const summariesResult = await query(
    `DELETE FROM daily_summaries
     WHERE summary_date < CURRENT_DATE - INTERVAL '90 days'`
  );
  totalDeleted += summariesResult.rowCount || 0;

  job.updateProgress(100);

  logger.info({ totalDeleted }, 'Cleanup completed');

  return { itemsDeleted: totalDeleted };
}

// Create and export the worker
export const scanOrchestratorWorker = new Worker<ScanOrchestratorJobData, OrchestratorResult>(
  QUEUE_NAMES.SCAN_ORCHESTRATOR,
  processScanOrchestrator,
  {
    connection,
    concurrency: 1, // Only run one orchestration at a time
  }
);

// Worker event handlers
scanOrchestratorWorker.on('completed', (job, result) => {
  logger.info({
    jobId: job.id,
    type: result.type,
    sourcesProcessed: result.sourcesProcessed,
    jobsQueued: result.jobsQueued,
  }, 'Scan orchestrator: job completed');
});

scanOrchestratorWorker.on('failed', (job, err) => {
  logger.error({
    jobId: job?.id,
    error: err.message,
  }, 'Scan orchestrator: job failed');
});

scanOrchestratorWorker.on('error', (err) => {
  logger.error({ error: err.message }, 'Scan orchestrator worker error');
});

// Graceful shutdown
export async function closeScanOrchestratorWorker() {
  await scanOrchestratorWorker.close();
  logger.info('Scan orchestrator worker closed');
}
