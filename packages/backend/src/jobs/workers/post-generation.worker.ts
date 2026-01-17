import { Worker, Job } from 'bullmq';
import { createBullMQConnection } from '../../config/redis.js';
import { QUEUE_NAMES, type PostGenerationJobData } from '../queues.js';
import { postGenerator } from '../../services/ai/post-generator.service.js';
import { GeneratedPostRepository } from '../../repositories/generated-post.repository.js';
import { logger } from '../../utils/logger.js';

const connection = createBullMQConnection();
const postRepo = new GeneratedPostRepository();

async function processPostGeneration(job: Job<PostGenerationJobData>) {
  const {
    articleId,
    title,
    lede,
    url,
    relevanceReasoning,
    potentialAngle,
    sourceName,
  } = job.data;

  logger.info({ articleId, jobId: job.id }, 'Processing post generation job');

  try {
    // Generate social media posts
    const result = await postGenerator.generatePosts({
      id: articleId,
      title,
      lede,
      url,
      relevanceReasoning,
      potentialAngle,
      sourceName,
    });

    // Save generated posts to database
    const generatedPost = await postRepo.create(articleId, result);

    logger.info({
      articleId,
      postId: generatedPost.id,
      tone: result.tone,
      qualityScore: result.qualityScore,
    }, 'Post generation completed');

    return {
      articleId,
      postId: generatedPost.id,
      tone: result.tone,
      qualityScore: result.qualityScore,
    };
  } catch (error) {
    logger.error({
      articleId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Post generation failed');

    throw error;
  }
}

// Create and export the worker
export const postGenerationWorker = new Worker<PostGenerationJobData>(
  QUEUE_NAMES.POST_GENERATION,
  processPostGeneration,
  {
    connection,
    concurrency: 2, // Process 2 articles in parallel (uses more expensive model)
    limiter: {
      max: 20,        // Max 20 jobs per minute
      duration: 60000,
    },
  }
);

// Worker event handlers
postGenerationWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id }, 'Post generation worker: job completed');
});

postGenerationWorker.on('failed', (job, err) => {
  logger.error({
    jobId: job?.id,
    error: err.message,
  }, 'Post generation worker: job failed');
});

postGenerationWorker.on('error', (err) => {
  logger.error({ error: err.message }, 'Post generation worker error');
});

// Graceful shutdown
export async function closePostGenerationWorker() {
  await postGenerationWorker.close();
  logger.info('Post generation worker closed');
}
