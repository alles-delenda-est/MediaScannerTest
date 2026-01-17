import { query } from '../config/database.js';
import { healthCheck } from '../config/database.js';
import { redisHealthCheck } from '../config/redis.js';
import type { DashboardStats, DailySummary, ArticleWithSource } from '@media-scanner/shared';

interface RecentActivity {
  type: 'article' | 'post' | 'scan';
  id: string;
  title: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

interface SystemHealth {
  database: 'up' | 'down';
  redis: 'up' | 'down';
  lastScan: Date | null;
  pendingArticles: number;
  queuedJobs: number;
}

export class DashboardRepository {
  async getStats(): Promise<DashboardStats> {
    const todayResult = await query<{
      articles: string;
      relevant: string;
      posts: string;
    }>(
      `SELECT
        COUNT(DISTINCT a.id) FILTER (WHERE DATE(a.created_at) = CURRENT_DATE) as articles,
        COUNT(DISTINCT a.id) FILTER (WHERE DATE(a.created_at) = CURRENT_DATE AND a.status = 'relevant') as relevant,
        COUNT(DISTINCT gp.id) FILTER (WHERE DATE(gp.created_at) = CURRENT_DATE) as posts
      FROM articles a
      LEFT JOIN generated_posts gp ON TRUE`
    );

    const weekResult = await query<{
      articles: string;
      relevant: string;
      posts: string;
    }>(
      `SELECT
        COUNT(DISTINCT a.id) FILTER (WHERE a.created_at >= CURRENT_DATE - INTERVAL '7 days') as articles,
        COUNT(DISTINCT a.id) FILTER (WHERE a.created_at >= CURRENT_DATE - INTERVAL '7 days' AND a.status = 'relevant') as relevant,
        COUNT(DISTINCT gp.id) FILTER (WHERE gp.created_at >= CURRENT_DATE - INTERVAL '7 days') as posts
      FROM articles a
      LEFT JOIN generated_posts gp ON TRUE`
    );

    const monthResult = await query<{
      articles: string;
      relevant: string;
      posts: string;
    }>(
      `SELECT
        COUNT(DISTINCT a.id) FILTER (WHERE a.created_at >= CURRENT_DATE - INTERVAL '30 days') as articles,
        COUNT(DISTINCT a.id) FILTER (WHERE a.created_at >= CURRENT_DATE - INTERVAL '30 days' AND a.status = 'relevant') as relevant,
        COUNT(DISTINCT gp.id) FILTER (WHERE gp.created_at >= CURRENT_DATE - INTERVAL '30 days') as posts
      FROM articles a
      LEFT JOIN generated_posts gp ON TRUE`
    );

    return {
      today: {
        articles: parseInt(todayResult.rows[0]?.articles || '0'),
        relevant: parseInt(todayResult.rows[0]?.relevant || '0'),
        postsGenerated: parseInt(todayResult.rows[0]?.posts || '0'),
      },
      week: {
        articles: parseInt(weekResult.rows[0]?.articles || '0'),
        relevant: parseInt(weekResult.rows[0]?.relevant || '0'),
        postsGenerated: parseInt(weekResult.rows[0]?.posts || '0'),
      },
      month: {
        articles: parseInt(monthResult.rows[0]?.articles || '0'),
        relevant: parseInt(monthResult.rows[0]?.relevant || '0'),
        postsGenerated: parseInt(monthResult.rows[0]?.posts || '0'),
      },
    };
  }

  async getTodaySummary(): Promise<DailySummary | null> {
    const result = await query<DailySummary>(
      `SELECT * FROM daily_summaries WHERE summary_date = CURRENT_DATE`
    );

    return result.rows[0] || null;
  }

  async getTopStories(limit: number): Promise<ArticleWithSource[]> {
    const result = await query<ArticleWithSource>(
      `SELECT
        a.*,
        json_build_object(
          'id', s.id,
          'name', s.name,
          'slug', s.slug
        ) as source
      FROM articles a
      LEFT JOIN sources s ON a.source_id = s.id
      WHERE a.status = 'relevant'
        AND a.published_at >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY a.relevance_score DESC NULLS LAST
      LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  async getRecentActivity(limit: number): Promise<RecentActivity[]> {
    // Get recent articles
    const articlesResult = await query<{
      id: string;
      title: string;
      created_at: Date;
      status: string;
      relevance_score: number;
    }>(
      `SELECT id, title, created_at, status, relevance_score
       FROM articles
       WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    const activity: RecentActivity[] = articlesResult.rows.map(row => ({
      type: 'article' as const,
      id: row.id,
      title: row.title,
      timestamp: row.created_at,
      metadata: { status: row.status, relevanceScore: row.relevance_score },
    }));

    return activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const dbHealthy = await healthCheck();
    const redisHealthy = await redisHealthCheck();

    const lastScanResult = await query<{ completed_at: Date }>(
      `SELECT completed_at FROM scan_logs WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1`
    );

    const pendingResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM articles WHERE status = 'pending'`
    );

    return {
      database: dbHealthy ? 'up' : 'down',
      redis: redisHealthy ? 'up' : 'down',
      lastScan: lastScanResult.rows[0]?.completed_at || null,
      pendingArticles: parseInt(pendingResult.rows[0]?.count || '0'),
      queuedJobs: 0, // TODO: Get from BullMQ
    };
  }

  async createOrUpdateDailySummary(date: string, data: Partial<DailySummary>): Promise<DailySummary> {
    const result = await query<DailySummary>(
      `INSERT INTO daily_summaries (
        summary_date,
        total_articles_scanned,
        total_social_posts_scanned,
        relevant_articles_count,
        relevant_social_posts_count,
        posts_generated,
        summary_text,
        top_stories,
        scan_started_at,
        scan_completed_at,
        scan_duration_seconds,
        errors_count,
        error_details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (summary_date) DO UPDATE SET
        total_articles_scanned = EXCLUDED.total_articles_scanned,
        relevant_articles_count = EXCLUDED.relevant_articles_count,
        posts_generated = EXCLUDED.posts_generated,
        summary_text = EXCLUDED.summary_text,
        top_stories = EXCLUDED.top_stories,
        scan_completed_at = EXCLUDED.scan_completed_at,
        scan_duration_seconds = EXCLUDED.scan_duration_seconds
      RETURNING *`,
      [
        date,
        data.totalArticlesScanned || 0,
        data.totalSocialPostsScanned || 0,
        data.relevantArticlesCount || 0,
        data.relevantSocialPostsCount || 0,
        data.postsGenerated || 0,
        data.summaryText || null,
        JSON.stringify(data.topStories || []),
        data.scanStartedAt || null,
        data.scanCompletedAt || null,
        data.scanDurationSeconds || null,
        data.errorsCount || 0,
        data.errorDetails ? JSON.stringify(data.errorDetails) : null,
      ]
    );

    return result.rows[0];
  }
}
