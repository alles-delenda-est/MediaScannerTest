import { Router } from 'express';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';
import { SourceRepository } from '../repositories/source.repository.js';
import { NotFoundError } from '../middleware/error-handler.js';
import type { SourceFilters } from '@media-scanner/shared';

export const router = Router();

const sourceRepo = new SourceRepository();

// GET /api/sources - List all sources
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const filters: SourceFilters = {
      type: req.query.type as string,
      category: req.query.category as string,
      active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
    };

    const sources = await sourceRepo.findAll(filters);
    res.json({ data: sources });
  } catch (error) {
    next(error);
  }
});

// GET /api/sources/:id - Get source with stats
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const source = await sourceRepo.findByIdWithStats(req.params.id);

    if (!source) {
      throw new NotFoundError('Source non trouvée');
    }

    res.json({ data: source });
  } catch (error) {
    next(error);
  }
});

// POST /api/sources - Add new source (admin only)
router.post('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const source = await sourceRepo.create(req.body);
    res.status(201).json({ data: source });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/sources/:id - Update source config
router.patch('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const source = await sourceRepo.update(req.params.id, req.body);

    if (!source) {
      throw new NotFoundError('Source non trouvée');
    }

    res.json({ data: source });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sources/:id - Deactivate source
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    await sourceRepo.deactivate(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/sources/:id/test - Test source connectivity
router.post('/:id/test', authenticate, async (req, res, next) => {
  try {
    const result = await sourceRepo.testConnectivity(req.params.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/sources/:id/logs - Get scan history for source
router.get('/:id/logs', optionalAuth, async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const logs = await sourceRepo.getScanLogs(req.params.id, limit);
    res.json({ data: logs });
  } catch (error) {
    next(error);
  }
});
