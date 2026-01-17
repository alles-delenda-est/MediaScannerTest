import cron from 'node-cron';
import { addScanJob, addDailySummaryJob } from './queues.js';
import { logger } from '../utils/logger.js';

// Track scheduled tasks for cleanup
const scheduledTasks: cron.ScheduledTask[] = [];

/**
 * Initialize all scheduled jobs
 * All times are in Paris timezone (Europe/Paris)
 */
export function initializeScheduler() {
  logger.info('Initializing scheduler...');

  // Main overnight scan - runs at 4:00 AM Paris time
  const fullScanTask = cron.schedule(
    '0 4 * * *',
    async () => {
      logger.info('Triggering scheduled full scan');
      try {
        await addScanJob({
          type: 'full',
          triggeredBy: 'scheduler',
        });
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Failed to trigger full scan');
      }
    },
    {
      timezone: 'Europe/Paris',
    }
  );
  scheduledTasks.push(fullScanTask);

  // Incremental scans every 2 hours during the day (8 AM - 10 PM Paris)
  const incrementalScanTask = cron.schedule(
    '0 8,10,12,14,16,18,20,22 * * *',
    async () => {
      logger.info('Triggering scheduled incremental scan');
      try {
        await addScanJob({
          type: 'incremental',
          triggeredBy: 'scheduler',
        });
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Failed to trigger incremental scan');
      }
    },
    {
      timezone: 'Europe/Paris',
    }
  );
  scheduledTasks.push(incrementalScanTask);

  // Daily summary generation at 6:00 AM Paris (after main scan completes)
  const dailySummaryTask = cron.schedule(
    '0 6 * * *',
    async () => {
      logger.info('Triggering daily summary generation');
      try {
        const today = new Date().toISOString().split('T')[0];
        await addDailySummaryJob(today);
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Failed to trigger daily summary');
      }
    },
    {
      timezone: 'Europe/Paris',
    }
  );
  scheduledTasks.push(dailySummaryTask);

  // Cleanup old data weekly (Sunday 3 AM Paris)
  const cleanupTask = cron.schedule(
    '0 3 * * 0',
    async () => {
      logger.info('Triggering weekly cleanup');
      try {
        await addScanJob({
          type: 'cleanup',
          triggeredBy: 'scheduler',
        });
      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Failed to trigger cleanup');
      }
    },
    {
      timezone: 'Europe/Paris',
    }
  );
  scheduledTasks.push(cleanupTask);

  logger.info({
    tasks: [
      'Full scan: 4:00 AM daily',
      'Incremental scan: every 2 hours (8 AM - 10 PM)',
      'Daily summary: 6:00 AM daily',
      'Cleanup: Sunday 3:00 AM weekly',
    ],
  }, 'Scheduler initialized');
}

/**
 * Stop all scheduled tasks
 */
export function stopScheduler() {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.length = 0;
  logger.info('Scheduler stopped');
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    tasksCount: scheduledTasks.length,
    tasks: [
      { name: 'Full Scan', schedule: '0 4 * * *', timezone: 'Europe/Paris' },
      { name: 'Incremental Scan', schedule: '0 8,10,12,14,16,18,20,22 * * *', timezone: 'Europe/Paris' },
      { name: 'Daily Summary', schedule: '0 6 * * *', timezone: 'Europe/Paris' },
      { name: 'Weekly Cleanup', schedule: '0 3 * * 0', timezone: 'Europe/Paris' },
    ],
  };
}

/**
 * Manually trigger a scan (for testing or API calls)
 */
export async function triggerManualScan(type: 'full' | 'incremental' = 'incremental') {
  logger.info({ type }, 'Triggering manual scan');

  await addScanJob({
    type,
    triggeredBy: 'manual',
  });
}

/**
 * Manually trigger daily summary generation (for testing)
 */
export async function triggerManualSummary(date?: string) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  logger.info({ date: targetDate }, 'Triggering manual summary');

  await addDailySummaryJob(targetDate);
}
