import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { DashboardRepository } from '../repositories/dashboard.repository.js';

export const router = Router();

const dashboardRepo = new DashboardRepository();

// GET /api/dashboard/stats - Overview statistics
router.get('/stats', optionalAuth, async (_req, res, next) => {
  try {
    const stats = await dashboardRepo.getStats();
    res.json({ data: stats });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/summary - Today's AI summary
router.get('/summary', optionalAuth, async (_req, res, next) => {
  try {
    const summary = await dashboardRepo.getTodaySummary();
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/top-stories - Top relevant stories
router.get('/top-stories', optionalAuth, async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const stories = await dashboardRepo.getTopStories(limit);
    res.json({ data: stories });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/recent - Recent activity feed
router.get('/recent', optionalAuth, async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const activity = await dashboardRepo.getRecentActivity(limit);
    res.json({ data: activity });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/health - System health status
router.get('/health', optionalAuth, async (_req, res, next) => {
  try {
    const health = await dashboardRepo.getSystemHealth();
    res.json({ data: health });
  } catch (error) {
    next(error);
  }
});
