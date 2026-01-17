import { query } from '../config/database.js';
import type { ArticleTopic, ArticleTopicWithTopic, Topic, TopicRelevanceResult } from '@media-scanner/shared';

interface DbArticleTopic {
  id: string;
  article_id: string;
  topic_id: string;
  relevance_score: string;
  reasoning: string | null;
  potential_angle: string | null;
  analyzed_at: Date;
}

interface DbArticleTopicWithTopic extends DbArticleTopic {
  topic_name: string;
  topic_slug: string;
  topic_description: string | null;
  topic_keywords: string[];
  topic_ai_prompt: string;
  topic_min_relevance_score: string;
  topic_is_active: boolean;
  topic_is_system: boolean;
}

function mapDbToArticleTopic(row: DbArticleTopic): ArticleTopic {
  return {
    id: row.id,
    articleId: row.article_id,
    topicId: row.topic_id,
    relevanceScore: parseFloat(row.relevance_score),
    reasoning: row.reasoning,
    potentialAngle: row.potential_angle,
    analyzedAt: row.analyzed_at,
  };
}

export class ArticleTopicRepository {
  async saveAnalysisResults(
    articleId: string,
    results: TopicRelevanceResult[]
  ): Promise<ArticleTopic[]> {
    const saved: ArticleTopic[] = [];

    for (const result of results) {
      const dbResult = await query<DbArticleTopic>(
        `INSERT INTO article_topics (article_id, topic_id, relevance_score, reasoning, potential_angle)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (article_id, topic_id) DO UPDATE SET
           relevance_score = EXCLUDED.relevance_score,
           reasoning = EXCLUDED.reasoning,
           potential_angle = EXCLUDED.potential_angle,
           analyzed_at = NOW()
         RETURNING *`,
        [
          articleId,
          result.topicId,
          result.relevanceScore,
          result.reasoning,
          result.potentialAngle,
        ]
      );

      if (dbResult.rows[0]) {
        saved.push(mapDbToArticleTopic(dbResult.rows[0]));
      }
    }

    return saved;
  }

  async findByArticle(articleId: string): Promise<ArticleTopicWithTopic[]> {
    const result = await query<DbArticleTopicWithTopic>(
      `SELECT
        at.*,
        t.name as topic_name,
        t.slug as topic_slug,
        t.description as topic_description,
        t.keywords as topic_keywords,
        t.ai_prompt as topic_ai_prompt,
        t.min_relevance_score as topic_min_relevance_score,
        t.is_active as topic_is_active,
        t.is_system as topic_is_system
       FROM article_topics at
       JOIN topics t ON at.topic_id = t.id
       WHERE at.article_id = $1
       ORDER BY at.relevance_score DESC`,
      [articleId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      articleId: row.article_id,
      topicId: row.topic_id,
      relevanceScore: parseFloat(row.relevance_score),
      reasoning: row.reasoning,
      potentialAngle: row.potential_angle,
      analyzedAt: row.analyzed_at,
      topic: {
        id: row.topic_id,
        name: row.topic_name,
        slug: row.topic_slug,
        description: row.topic_description,
        keywords: row.topic_keywords,
        aiPrompt: row.topic_ai_prompt,
        minRelevanceScore: parseFloat(row.topic_min_relevance_score),
        isActive: row.topic_is_active,
        isSystem: row.topic_is_system,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }));
  }

  async findByTopic(
    topicId: string,
    options?: { limit?: number; offset?: number; minScore?: number }
  ): Promise<ArticleTopic[]> {
    const conditions = ['topic_id = $1'];
    const values: unknown[] = [topicId];
    let paramIndex = 2;

    if (options?.minScore !== undefined) {
      conditions.push(`relevance_score >= $${paramIndex++}`);
      values.push(options.minScore);
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const result = await query<DbArticleTopic>(
      `SELECT * FROM article_topics
       WHERE ${conditions.join(' AND ')}
       ORDER BY relevance_score DESC, analyzed_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, limit, offset]
    );

    return result.rows.map(mapDbToArticleTopic);
  }

  async getTopScoreForArticle(articleId: string): Promise<number | null> {
    const result = await query<{ max_score: string }>(
      'SELECT MAX(relevance_score) as max_score FROM article_topics WHERE article_id = $1',
      [articleId]
    );

    return result.rows[0]?.max_score ? parseFloat(result.rows[0].max_score) : null;
  }

  async deleteByArticle(articleId: string): Promise<void> {
    await query('DELETE FROM article_topics WHERE article_id = $1', [articleId]);
  }

  async deleteByTopic(topicId: string): Promise<void> {
    await query('DELETE FROM article_topics WHERE topic_id = $1', [topicId]);
  }
}
