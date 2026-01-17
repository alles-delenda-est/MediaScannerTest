import { Worker, Job } from 'bullmq';
import { createBullMQConnection } from '../../config/redis.js';
import { QUEUE_NAMES, addAiAnalysisJob, type RssScanJobData } from '../queues.js';
import { rssFetcher } from '../../services/rss/rss-fetcher.service.js';
import { rssNormalizer } from '../../services/rss/rss-normalizer.service.js';
import { deduplicator } from '../../services/scanner/deduplicator.service.js';
import { ArticleRepository } from '../../repositories/article.repository.js';
import { SourceRepository } from '../../repositories/source.repository.js';
import { ScanRepository } from '../../repositories/scan.repository.js';
import { TopicRepository } from '../../repositories/topic.repository.js';
import { logger } from '../../utils/logger.js';

const connection = createBullMQConnection();
const articleRepo = new ArticleRepository();
const sourceRepo = new SourceRepository();
const scanRepo = new ScanRepository();
const topicRepo = new TopicRepository();

interface RssScanResult {
  sourceId: string;
  sourceName: string;
  fetched: number;
  normalized: number;
  newArticles: number;
  duplicates: number;
  queued: number;
  errors: string[];
}

async function processRssScan(job: Job<RssScanJobData>): Promise<RssScanResult> {
  const { sourceId, feedUrl, sourceName } = job.data;

  logger.info({ sourceId, sourceName, feedUrl, jobId: job.id }, 'Processing RSS scan job');

  const errors: string[] = [];
  let fetched = 0;
  let normalized = 0;
  let newArticles = 0;
  let duplicates = 0;
  let queued = 0;

  try {
    // Create scan log entry
    const scanLog = await scanRepo.create(sourceId, 'scheduled');

    // Step 1: Fetch RSS feed
    const fetchResult = await rssFetcher.fetchFeed(feedUrl, sourceName);

    if (!fetchResult.success || !fetchResult.feed) {
      errors.push(`Fetch failed: ${fetchResult.error}`);
      await sourceRepo.updateError(sourceId, fetchResult.error || 'Unknown fetch error');
      await scanRepo.fail(scanLog.id, fetchResult.error || 'Fetch failed');

      return {
        sourceId,
        sourceName,
        fetched: 0,
        normalized: 0,
        newArticles: 0,
        duplicates: 0,
        queued: 0,
        errors,
      };
    }

    fetched = fetchResult.itemCount;
    job.updateProgress(20);

    // Step 2: Normalize RSS items to articles
    const normalizeResult = rssNormalizer.normalizeItems(
      fetchResult.feed.items,
      sourceId,
      sourceName
    );

    normalized = normalizeResult.articles.length;
    job.updateProgress(40);

    // Step 3: Filter duplicates
    const dedupeResult = await deduplicator.filterDuplicates(normalizeResult.articles);

    newArticles = dedupeResult.newArticles.length;
    duplicates = dedupeResult.duplicates;
    job.updateProgress(60);

    // Fetch active topics for keyword checking
    const activeTopics = await topicRepo.findActive();
    const topicsForMatching = activeTopics.map((t) => ({
      id: t.id,
      keywords: t.keywords,
    }));

    logger.debug({ topicCount: activeTopics.length }, 'Active topics loaded for keyword matching');

    // Step 4: Insert new articles into database
    const insertedArticles: string[] = [];

    for (const article of dedupeResult.newArticles) {
      try {
        const created = await articleRepo.create({
          sourceId: article.sourceId,
          externalId: article.externalId,
          url: article.url,
          title: article.title,
          lede: article.lede,
          fullText: article.fullText,
          author: article.author,
          publishedAt: article.publishedAt,
        });

        if (created) {
          insertedArticles.push(created.id);

          // Queue for AI analysis if it matches any topic's keywords
          const matchedTopicIds = rssNormalizer.checkAgainstTopics(article, topicsForMatching);

          if (matchedTopicIds.length > 0) {
            await addAiAnalysisJob({
              articleId: created.id,
              title: article.title,
              lede: article.lede || '',
              sourceName,
              url: article.url,
              topicIds: matchedTopicIds,
            });
            queued++;
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown insert error';
        // Duplicate key errors are expected due to race conditions, skip silently
        if (!errorMsg.includes('duplicate key')) {
          errors.push(`Insert error for ${article.url}: ${errorMsg}`);
        }
      }
    }

    job.updateProgress(90);

    // Mark URLs as stored for future deduplication
    await deduplicator.markBatchAsStored(
      dedupeResult.newArticles.map((a) => a.url)
    );

    // Update source last fetched timestamp
    await sourceRepo.updateLastFetched(sourceId);

    // Update scan log
    await scanRepo.updateProgress(scanLog.id, {
      itemsFound: fetched,
      itemsNew: newArticles,
      itemsAnalyzed: 0,
      itemsRelevant: 0,
    });
    await scanRepo.complete(scanLog.id, errors.length > 0 ? 'partial' : 'completed');

    job.updateProgress(100);

    logger.info({
      sourceId,
      sourceName,
      fetched,
      normalized,
      newArticles,
      duplicates,
      queued,
      errors: errors.length,
    }, 'RSS scan completed');

    return {
      sourceId,
      sourceName,
      fetched,
      normalized,
      newArticles,
      duplicates,
      queued,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ sourceId, sourceName, error: errorMsg }, 'RSS scan failed');

    await sourceRepo.updateError(sourceId, errorMsg);

    throw error;
  }
}

// Create and export the worker
export const rssScanWorker = new Worker<RssScanJobData, RssScanResult>(
  QUEUE_NAMES.RSS_SCAN,
  processRssScan,
  {
    connection,
    concurrency: 5, // Process 5 feeds in parallel
    limiter: {
      max: 20,        // Max 20 jobs per minute
      duration: 60000,
    },
  }
);

// Worker event handlers
rssScanWorker.on('completed', (job, result) => {
  logger.info({
    jobId: job.id,
    sourceName: result.sourceName,
    newArticles: result.newArticles,
    queued: result.queued,
  }, 'RSS scan worker: job completed');
});

rssScanWorker.on('failed', (job, err) => {
  logger.error({
    jobId: job?.id,
    error: err.message,
  }, 'RSS scan worker: job failed');
});

rssScanWorker.on('error', (err) => {
  logger.error({ error: err.message }, 'RSS scan worker error');
});

// Graceful shutdown
export async function closeRssScanWorker() {
  await rssScanWorker.close();
  logger.info('RSS scan worker closed');
}
