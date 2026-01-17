import { Worker, Job } from 'bullmq';
import { createBullMQConnection } from '../../config/redis.js';
import { QUEUE_NAMES, addPostGenerationJob, type AiAnalysisJobData } from '../queues.js';
import { relevanceAnalyzer } from '../../services/ai/relevance-analyzer.service.js';
import { ArticleRepository } from '../../repositories/article.repository.js';
import { TopicRepository } from '../../repositories/topic.repository.js';
import { ArticleTopicRepository } from '../../repositories/article-topic.repository.js';
import { logger } from '../../utils/logger.js';

const connection = createBullMQConnection();
const articleRepo = new ArticleRepository();
const topicRepo = new TopicRepository();
const articleTopicRepo = new ArticleTopicRepository();

// Minimum relevance score to trigger post generation
const POST_GENERATION_THRESHOLD = 0.6;

async function processAiAnalysis(job: Job<AiAnalysisJobData>) {
  const { articleId, title, lede, sourceName, url, topicIds } = job.data;

  logger.info({ articleId, jobId: job.id, topicCount: topicIds?.length }, 'Processing AI analysis job');

  // Update article status to analyzing
  await articleRepo.update(articleId, { status: 'analyzing' });

  try {
    // Determine which topics to analyze against
    let topicsToAnalyze = [];

    if (topicIds && topicIds.length > 0) {
      // Fetch specific topics
      const allTopics = await Promise.all(
        topicIds.map((id) => topicRepo.findById(id))
      );
      topicsToAnalyze = allTopics.filter((t) => t !== null);
    } else {
      // Fallback: analyze against all active topics
      topicsToAnalyze = await topicRepo.findActive();
    }

    if (topicsToAnalyze.length === 0) {
      logger.warn({ articleId }, 'No topics to analyze against, using legacy analysis');

      // Fallback to legacy single-topic analysis
      const result = await relevanceAnalyzer.analyzeArticle({
        id: articleId,
        title,
        lede,
        source: sourceName,
        url,
      });

      await articleRepo.updateAnalysis(articleId, {
        relevanceScore: result.relevanceScore,
        relevanceReasoning: result.reasoning,
        keywords: result.keywords,
        categories: result.categories,
        potentialAngle: result.potentialAngle,
      });

      if (result.relevanceScore >= POST_GENERATION_THRESHOLD) {
        await addPostGenerationJob({
          articleId,
          title,
          lede,
          url,
          relevanceReasoning: result.reasoning,
          potentialAngle: result.potentialAngle,
          sourceName,
        });
      }

      return {
        articleId,
        relevanceScore: result.relevanceScore,
        queuedForPostGeneration: result.relevanceScore >= POST_GENERATION_THRESHOLD,
      };
    }

    // Run multi-topic relevance analysis
    const topicResults = await relevanceAnalyzer.analyzeArticleForTopics(
      {
        id: articleId,
        title,
        lede,
        source: sourceName,
        url,
      },
      topicsToAnalyze
    );

    // Save topic-specific results to article_topics table
    await articleTopicRepo.saveAnalysisResults(articleId, topicResults);

    // Find the best score across all topics
    const bestResult = topicResults.reduce(
      (best, current) =>
        current.relevanceScore > best.relevanceScore ? current : best,
      topicResults[0]
    );

    // Update article with best result (for backward compatibility)
    await articleRepo.updateAnalysis(articleId, {
      relevanceScore: bestResult.relevanceScore,
      relevanceReasoning: `[${bestResult.topicName}] ${bestResult.reasoning}`,
      keywords: [], // Topic-specific, stored in article_topics
      categories: [bestResult.topicName],
      potentialAngle: bestResult.potentialAngle,
    });

    logger.info({
      articleId,
      topicCount: topicsToAnalyze.length,
      bestScore: bestResult.relevanceScore,
      bestTopic: bestResult.topicName,
      allScores: topicResults.map((r) => ({ topic: r.topicName, score: r.relevanceScore })),
    }, 'Multi-topic AI analysis completed');

    // If any topic has high relevance, queue for post generation
    const highRelevanceResults = topicResults.filter(
      (r) => r.relevanceScore >= POST_GENERATION_THRESHOLD
    );

    if (highRelevanceResults.length > 0) {
      // Use the best result for post generation
      await addPostGenerationJob({
        articleId,
        title,
        lede,
        url,
        relevanceReasoning: bestResult.reasoning,
        potentialAngle: bestResult.potentialAngle,
        sourceName,
      });

      logger.info({ articleId, topic: bestResult.topicName }, 'Queued for post generation');
    }

    return {
      articleId,
      relevanceScore: bestResult.relevanceScore,
      topicScores: topicResults.map((r) => ({
        topicId: r.topicId,
        topicName: r.topicName,
        score: r.relevanceScore,
      })),
      queuedForPostGeneration: highRelevanceResults.length > 0,
    };
  } catch (error) {
    // Mark article as error
    await articleRepo.update(articleId, { status: 'error' });

    logger.error({
      articleId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'AI analysis failed');

    throw error;
  }
}

// Create and export the worker
export const aiAnalysisWorker = new Worker<AiAnalysisJobData>(
  QUEUE_NAMES.AI_ANALYSIS,
  processAiAnalysis,
  {
    connection,
    concurrency: 3, // Process 3 articles in parallel
    limiter: {
      max: 30,        // Max 30 jobs per minute (half of API limit)
      duration: 60000,
    },
  }
);

// Worker event handlers
aiAnalysisWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id }, 'AI analysis worker: job completed');
});

aiAnalysisWorker.on('failed', (job, err) => {
  logger.error({
    jobId: job?.id,
    error: err.message,
  }, 'AI analysis worker: job failed');
});

aiAnalysisWorker.on('error', (err) => {
  logger.error({ error: err.message }, 'AI analysis worker error');
});

// Graceful shutdown
export async function closeAiAnalysisWorker() {
  await aiAnalysisWorker.close();
  logger.info('AI analysis worker closed');
}
