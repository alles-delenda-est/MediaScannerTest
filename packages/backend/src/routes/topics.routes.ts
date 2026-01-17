import { Router } from 'express';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';
import { TopicRepository } from '../repositories/topic.repository.js';
import { ArticleTopicRepository } from '../repositories/article-topic.repository.js';
import { NotFoundError, BadRequestError } from '../middleware/error-handler.js';
import type { TopicFilters, CreateTopicInput, UpdateTopicInput } from '@media-scanner/shared';

export const router = Router();

const topicRepo = new TopicRepository();
const articleTopicRepo = new ArticleTopicRepository();

// GET /api/topics - List all topics
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const filters: TopicFilters = {
      active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
    };

    const topics = await topicRepo.findAll(filters);
    res.json({ data: topics });
  } catch (error) {
    next(error);
  }
});

// GET /api/topics/:id - Get topic details
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const topic = await topicRepo.findById(req.params.id);

    if (!topic) {
      throw new NotFoundError('Topic non trouvé');
    }

    res.json({ data: topic });
  } catch (error) {
    next(error);
  }
});

// POST /api/topics - Create new topic (admin only)
router.post('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const input: CreateTopicInput = {
      name: req.body.name,
      description: req.body.description,
      keywords: req.body.keywords,
      aiPrompt: req.body.aiPrompt,
      minRelevanceScore: req.body.minRelevanceScore,
      isActive: req.body.isActive,
    };

    if (!input.name || !input.keywords || !input.aiPrompt) {
      throw new BadRequestError('name, keywords, and aiPrompt are required');
    }

    if (!Array.isArray(input.keywords) || input.keywords.length === 0) {
      throw new BadRequestError('keywords must be a non-empty array');
    }

    const topic = await topicRepo.create(input, req.user?.id);
    res.status(201).json({ data: topic });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/topics/:id - Update topic (admin only)
router.patch('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const input: UpdateTopicInput = {
      name: req.body.name,
      description: req.body.description,
      keywords: req.body.keywords,
      aiPrompt: req.body.aiPrompt,
      minRelevanceScore: req.body.minRelevanceScore,
      isActive: req.body.isActive,
    };

    // Remove undefined fields
    Object.keys(input).forEach((key) => {
      if (input[key as keyof UpdateTopicInput] === undefined) {
        delete input[key as keyof UpdateTopicInput];
      }
    });

    const topic = await topicRepo.update(req.params.id, input);

    if (!topic) {
      throw new NotFoundError('Topic non trouvé');
    }

    res.json({ data: topic });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/topics/:id - Delete topic (admin only, non-system only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const deleted = await topicRepo.delete(req.params.id);

    if (!deleted) {
      throw new NotFoundError('Topic non trouvé ou ne peut pas être supprimé');
    }

    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === 'Cannot delete system topics') {
      next(new BadRequestError('Impossible de supprimer les topics système'));
    } else {
      next(error);
    }
  }
});

// POST /api/topics/:id/toggle - Toggle topic active status (admin only)
router.post('/:id/toggle', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const topic = await topicRepo.toggleActive(req.params.id);

    if (!topic) {
      throw new NotFoundError('Topic non trouvé');
    }

    res.json({ data: topic });
  } catch (error) {
    next(error);
  }
});

// GET /api/topics/:id/articles - Get articles for a topic
router.get('/:id/articles', optionalAuth, async (req, res, next) => {
  try {
    const topic = await topicRepo.findById(req.params.id);

    if (!topic) {
      throw new NotFoundError('Topic non trouvé');
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const minScore = req.query.minScore ? parseFloat(req.query.minScore as string) : undefined;

    const articleTopics = await articleTopicRepo.findByTopic(req.params.id, {
      limit,
      offset,
      minScore,
    });

    res.json({ data: articleTopics });
  } catch (error) {
    next(error);
  }
});
