import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { ScanRepository } from '../repositories/scan.repository.js';
import { ArticleRepository } from '../repositories/article.repository.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { addScanJob, addAiAnalysisJob, getQueueStats } from '../jobs/queues.js';
import { triggerManualSummary } from '../jobs/scheduler.js';

export const router = Router();

const scanRepo = new ScanRepository();
const articleRepo = new ArticleRepository();

// GET /api/scans - List scan history
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const result = await scanRepo.findAll({ page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/scans/status - Get current scan status
router.get('/status', optionalAuth, async (_req, res, next) => {
  try {
    const status = await scanRepo.getCurrentStatus();
    res.json({ data: status });
  } catch (error) {
    next(error);
  }
});

// POST /api/scans/trigger - Manually trigger full scan
router.post('/trigger', authenticate, async (req, res, next) => {
  try {
    const { type = 'incremental' } = req.body;

    // Add job to queue
    const job = await addScanJob({
      type,
      triggeredBy: 'manual',
    });

    // Also create scan log entry
    const scan = await scanRepo.createManualScan(type);

    res.status(202).json({
      data: {
        message: 'Scan déclenché',
        scanId: scan.id,
        jobId: job.id,
        type,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/scans/trigger/:sourceId - Trigger scan for specific source
router.post('/trigger/:sourceId', authenticate, async (req, res, next) => {
  try {
    const job = await addScanJob({
      type: 'incremental',
      triggeredBy: 'manual',
      sourceId: req.params.sourceId,
    });

    const scan = await scanRepo.createManualScan('manual', req.params.sourceId);

    res.status(202).json({
      data: {
        message: 'Scan de source déclenché',
        scanId: scan.id,
        jobId: job.id,
        sourceId: req.params.sourceId,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/scans/queues - Get queue statistics
router.get('/queues', authenticate, async (_req, res, next) => {
  try {
    const stats = await getQueueStats();
    res.json({ data: stats });
  } catch (error) {
    next(error);
  }
});

// POST /api/scans/analyze-pending - Trigger AI analysis for pending articles
router.post('/analyze-pending', authenticate, async (req, res, next) => {
  try {
    const limit = req.body.limit || 50;

    // Get pending articles
    const pendingArticles = await articleRepo.findPendingForAnalysis(limit);

    if (pendingArticles.length === 0) {
      res.json({
        data: {
          message: 'Aucun article en attente d\'analyse',
          queued: 0,
        },
      });
      return;
    }

    // Queue each article for AI analysis
    let queued = 0;
    for (const article of pendingArticles) {
      await addAiAnalysisJob({
        articleId: article.id,
        title: article.title,
        lede: article.lede || '',
        sourceName: 'Unknown', // We'd need to join with source table
        url: article.url,
      });
      queued++;
    }

    res.status(202).json({
      data: {
        message: `${queued} articles mis en file d'attente pour analyse`,
        queued,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/scans/generate-summary - Trigger daily summary generation
router.post('/generate-summary', authenticate, async (req, res, next) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];

    await triggerManualSummary(date);

    res.status(202).json({
      data: {
        message: 'Génération de synthèse déclenchée',
        date,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/scans/:id - Get scan details
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const scan = await scanRepo.findById(req.params.id);

    if (!scan) {
      throw new NotFoundError('Scan non trouvé');
    }

    res.json({ data: scan });
  } catch (error) {
    next(error);
  }
});
