import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { GeneratedPostRepository } from '../repositories/generated-post.repository.js';
import { NotFoundError } from '../middleware/error-handler.js';
import type { PostQueryParams } from '@media-scanner/shared';

export const router = Router();

const postRepo = new GeneratedPostRepository();

// GET /api/posts - List generated posts
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const params: PostQueryParams = {
      status: req.query.status as string,
      articleId: req.query.article_id as string,
      from: req.query.from as string,
      to: req.query.to as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await postRepo.findAll(params);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/posts/today - Get today's posts for morning review
router.get('/today', optionalAuth, async (_req, res, next) => {
  try {
    const posts = await postRepo.findTodayPosts();
    res.json({ data: posts });
  } catch (error) {
    next(error);
  }
});

// GET /api/posts/:id - Get single post with article context
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const post = await postRepo.findById(req.params.id);

    if (!post) {
      throw new NotFoundError('Post non trouvé');
    }

    res.json({ data: post });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/posts/:id - Update post (edit content, change status)
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const post = await postRepo.update(req.params.id, req.body);

    if (!post) {
      throw new NotFoundError('Post non trouvé');
    }

    res.json({ data: post });
  } catch (error) {
    next(error);
  }
});

// POST /api/posts/:id/approve - Approve post for publishing
router.post('/:id/approve', authenticate, async (req, res, next) => {
  try {
    const post = await postRepo.approve(req.params.id, req.user!.id);

    if (!post) {
      throw new NotFoundError('Post non trouvé');
    }

    res.json({ data: post });
  } catch (error) {
    next(error);
  }
});

// POST /api/posts/:id/reject - Reject post
router.post('/:id/reject', authenticate, async (req, res, next) => {
  try {
    const post = await postRepo.reject(req.params.id);

    if (!post) {
      throw new NotFoundError('Post non trouvé');
    }

    res.json({ data: post });
  } catch (error) {
    next(error);
  }
});

// POST /api/posts/:id/regenerate - Request new AI generation
router.post('/:id/regenerate', authenticate, async (req, res, next) => {
  try {
    // TODO: Implement regeneration with AI service
    const post = await postRepo.markForRegeneration(req.params.id);

    if (!post) {
      throw new NotFoundError('Post non trouvé');
    }

    res.json({ data: { message: 'Régénération en cours', post } });
  } catch (error) {
    next(error);
  }
});

// POST /api/posts/:id/publish - Publish to social platforms
router.post('/:id/publish', authenticate, async (req, res, next) => {
  try {
    const { platforms } = req.body;

    // TODO: Implement actual publishing to social platforms
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Publication automatique non encore implémentée',
        suggestion: 'Utilisez le bouton de copie pour publier manuellement',
      },
    });
  } catch (error) {
    next(error);
  }
});
