import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { ArticleRepository } from '../repositories/article.repository.js';
import { NotFoundError } from '../middleware/error-handler.js';
import type { ArticleQueryParams } from '@media-scanner/shared';

export const router = Router();

const articleRepo = new ArticleRepository();

// GET /api/articles - List articles with filtering
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const params: ArticleQueryParams = {
      status: req.query.status as string,
      sourceId: req.query.source_id as string,
      from: req.query.from as string,
      to: req.query.to as string,
      minScore: req.query.min_score ? parseFloat(req.query.min_score as string) : undefined,
      category: req.query.category as string,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      sort: (req.query.sort as 'relevance' | 'date') || 'date',
      order: (req.query.order as 'asc' | 'desc') || 'desc',
    };

    const result = await articleRepo.findAll(params);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/articles/:id - Get single article
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const article = await articleRepo.findById(req.params.id);

    if (!article) {
      throw new NotFoundError('Article non trouvé');
    }

    res.json({ data: article });
  } catch (error) {
    next(error);
  }
});

// GET /api/articles/:id/posts - Get generated posts for article
router.get('/:id/posts', optionalAuth, async (req, res, next) => {
  try {
    const posts = await articleRepo.findPostsForArticle(req.params.id);
    res.json({ data: posts });
  } catch (error) {
    next(error);
  }
});

// POST /api/articles/:id/reanalyze - Trigger re-analysis
router.post('/:id/reanalyze', authenticate, async (req, res, next) => {
  try {
    await articleRepo.markForReanalysis(req.params.id);
    res.json({ data: { message: 'Article marqué pour ré-analyse' } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/articles/:id - Update article
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const article = await articleRepo.update(req.params.id, req.body);

    if (!article) {
      throw new NotFoundError('Article non trouvé');
    }

    res.json({ data: article });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/articles/:id - Soft delete article
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await articleRepo.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
