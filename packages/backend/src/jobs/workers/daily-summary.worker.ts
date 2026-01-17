import { Worker, Job } from 'bullmq';
import { createBullMQConnection } from '../../config/redis.js';
import { QUEUE_NAMES, type DailySummaryJobData } from '../queues.js';
import { postGenerator } from '../../services/ai/post-generator.service.js';
import { ArticleRepository } from '../../repositories/article.repository.js';
import { DashboardRepository } from '../../repositories/dashboard.repository.js';
import { logger } from '../../utils/logger.js';

const connection = createBullMQConnection();
const articleRepo = new ArticleRepository();
const dashboardRepo = new DashboardRepository();

async function processDailySummary(job: Job<DailySummaryJobData>) {
  const { date } = job.data;

  logger.info({ date, jobId: job.id }, 'Processing daily summary job');

  try {
    // Get today's relevant articles
    const articlesResult = await articleRepo.findAll({
      status: 'relevant',
      from: date,
      to: date,
      sort: 'relevance',
      order: 'desc',
      limit: 20,
    });

    const relevantArticles = articlesResult.data;

    if (relevantArticles.length === 0) {
      logger.info({ date }, 'No relevant articles found for daily summary');

      await dashboardRepo.createOrUpdateDailySummary(date, {
        totalArticlesScanned: 0,
        relevantArticlesCount: 0,
        postsGenerated: 0,
        summaryText: 'Aucun article pertinent identifié ce jour.',
        scanCompletedAt: new Date(),
      });

      return { date, articlesCount: 0 };
    }

    // Generate summary using AI
    const summaryResult = await postGenerator.generateDailySummary(
      relevantArticles.map((a) => ({
        title: a.title,
        source: a.source?.name || 'Source inconnue',
        relevanceScore: a.relevanceScore || 0,
        reasoning: a.relevanceReasoning || '',
      }))
    );

    // Build full summary text
    const summaryText = [
      `# ${summaryResult.title}`,
      '',
      summaryResult.introduction,
      '',
      '## Points clés',
      ...summaryResult.keyPoints.map((p) => `- ${p}`),
      '',
      summaryResult.conclusion,
    ].join('\n');

    // Get stats for the summary
    const stats = await dashboardRepo.getStats();

    // Save summary to database
    await dashboardRepo.createOrUpdateDailySummary(date, {
      totalArticlesScanned: stats.today.articles,
      relevantArticlesCount: stats.today.relevant,
      postsGenerated: stats.today.postsGenerated,
      summaryText,
      topStories: relevantArticles.slice(0, 5).map((a) => ({
        articleId: a.id,
        title: a.title,
        relevanceScore: a.relevanceScore || 0,
        snippet: a.lede?.slice(0, 200) || '',
      })),
      scanCompletedAt: new Date(),
    });

    logger.info({
      date,
      articlesCount: relevantArticles.length,
    }, 'Daily summary generated');

    return {
      date,
      articlesCount: relevantArticles.length,
      title: summaryResult.title,
    };
  } catch (error) {
    logger.error({
      date,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Daily summary generation failed');

    throw error;
  }
}

// Create and export the worker
export const dailySummaryWorker = new Worker<DailySummaryJobData>(
  QUEUE_NAMES.DAILY_SUMMARY,
  processDailySummary,
  {
    connection,
    concurrency: 1, // Only process one summary at a time
  }
);

// Worker event handlers
dailySummaryWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Daily summary worker: job completed');
});

dailySummaryWorker.on('failed', (job, err) => {
  logger.error({
    jobId: job?.id,
    error: err.message,
  }, 'Daily summary worker: job failed');
});

dailySummaryWorker.on('error', (err) => {
  logger.error({ error: err.message }, 'Daily summary worker error');
});

// Graceful shutdown
export async function closeDailySummaryWorker() {
  await dailySummaryWorker.close();
  logger.info('Daily summary worker closed');
}
