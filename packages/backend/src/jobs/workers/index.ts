import { aiAnalysisWorker, closeAiAnalysisWorker } from './ai-analysis.worker.js';
import { postGenerationWorker, closePostGenerationWorker } from './post-generation.worker.js';
import { dailySummaryWorker, closeDailySummaryWorker } from './daily-summary.worker.js';
import { rssScanWorker, closeRssScanWorker } from './rss-scan.worker.js';
import { scanOrchestratorWorker, closeScanOrchestratorWorker } from './scan-orchestrator.worker.js';
import { logger } from '../../utils/logger.js';

// Export workers for external access if needed
export {
  aiAnalysisWorker,
  postGenerationWorker,
  dailySummaryWorker,
  rssScanWorker,
  scanOrchestratorWorker,
};

/**
 * Start all workers
 * Workers are automatically started when imported, this just logs confirmation
 */
export function initializeWorkers() {
  logger.info({
    workers: [
      { name: 'AI Analysis', concurrency: 3 },
      { name: 'Post Generation', concurrency: 2 },
      { name: 'Daily Summary', concurrency: 1 },
      { name: 'RSS Scan', concurrency: 5 },
      { name: 'Scan Orchestrator', concurrency: 1 },
    ],
  }, 'Workers initialized');
}

/**
 * Gracefully close all workers
 */
export async function closeAllWorkers() {
  logger.info('Closing all workers...');

  await Promise.all([
    closeAiAnalysisWorker(),
    closePostGenerationWorker(),
    closeDailySummaryWorker(),
    closeRssScanWorker(),
    closeScanOrchestratorWorker(),
  ]);

  logger.info('All workers closed');
}

/**
 * Get workers status
 */
export async function getWorkersStatus() {
  return {
    aiAnalysis: {
      running: aiAnalysisWorker.isRunning(),
      paused: aiAnalysisWorker.isPaused(),
    },
    postGeneration: {
      running: postGenerationWorker.isRunning(),
      paused: postGenerationWorker.isPaused(),
    },
    dailySummary: {
      running: dailySummaryWorker.isRunning(),
      paused: dailySummaryWorker.isPaused(),
    },
    rssScan: {
      running: rssScanWorker.isRunning(),
      paused: rssScanWorker.isPaused(),
    },
    scanOrchestrator: {
      running: scanOrchestratorWorker.isRunning(),
      paused: scanOrchestratorWorker.isPaused(),
    },
  };
}

/**
 * Pause all workers (useful for maintenance)
 */
export async function pauseAllWorkers() {
  await Promise.all([
    aiAnalysisWorker.pause(),
    postGenerationWorker.pause(),
    dailySummaryWorker.pause(),
    rssScanWorker.pause(),
    scanOrchestratorWorker.pause(),
  ]);
  logger.info('All workers paused');
}

/**
 * Resume all workers
 */
export async function resumeAllWorkers() {
  await Promise.all([
    aiAnalysisWorker.resume(),
    postGenerationWorker.resume(),
    dailySummaryWorker.resume(),
    rssScanWorker.resume(),
    scanOrchestratorWorker.resume(),
  ]);
  logger.info('All workers resumed');
}
