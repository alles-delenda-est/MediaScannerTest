import { query } from '../config/database.js';
import type {
  GeneratedPost,
  GeneratedPostWithArticle,
  PostQueryParams,
  PaginatedResponse,
  GeneratePostsResult,
} from '@media-scanner/shared';

export class GeneratedPostRepository {
  async findAll(params: PostQueryParams): Promise<PaginatedResponse<GeneratedPostWithArticle>> {
    const { status, articleId, from, to, page = 1, limit = 20 } = params;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`gp.status = $${paramIndex++}`);
      values.push(status);
    }

    if (articleId) {
      conditions.push(`gp.article_id = $${paramIndex++}`);
      values.push(articleId);
    }

    if (from) {
      conditions.push(`gp.created_at >= $${paramIndex++}`);
      values.push(from);
    }

    if (to) {
      conditions.push(`gp.created_at <= $${paramIndex++}`);
      values.push(to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM generated_posts gp ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await query<GeneratedPostWithArticle>(
      `SELECT
        gp.*,
        json_build_object(
          'id', a.id,
          'title', a.title,
          'url', a.url,
          'source', json_build_object('name', s.name)
        ) as article
      FROM generated_posts gp
      LEFT JOIN articles a ON gp.article_id = a.id
      LEFT JOIN sources s ON a.source_id = s.id
      ${whereClause}
      ORDER BY gp.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    return {
      data: dataResult.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<GeneratedPostWithArticle | null> {
    const result = await query<GeneratedPostWithArticle>(
      `SELECT
        gp.*,
        json_build_object(
          'id', a.id,
          'title', a.title,
          'url', a.url,
          'lede', a.lede,
          'relevance_score', a.relevance_score,
          'source', json_build_object('name', s.name)
        ) as article
      FROM generated_posts gp
      LEFT JOIN articles a ON gp.article_id = a.id
      LEFT JOIN sources s ON a.source_id = s.id
      WHERE gp.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  async findTodayPosts(): Promise<GeneratedPostWithArticle[]> {
    const result = await query<GeneratedPostWithArticle>(
      `SELECT
        gp.*,
        json_build_object(
          'id', a.id,
          'title', a.title,
          'url', a.url,
          'source', json_build_object('name', s.name)
        ) as article
      FROM generated_posts gp
      LEFT JOIN articles a ON gp.article_id = a.id
      LEFT JOIN sources s ON a.source_id = s.id
      WHERE DATE(gp.created_at) = CURRENT_DATE
      ORDER BY gp.created_at DESC`
    );

    return result.rows;
  }

  async create(articleId: string, content: GeneratePostsResult): Promise<GeneratedPost> {
    const result = await query<GeneratedPost>(
      `INSERT INTO generated_posts (
        article_id,
        content_twitter,
        content_mastodon,
        content_bluesky,
        tone,
        hashtags,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'draft')
      RETURNING *`,
      [
        articleId,
        content.twitter.content,
        content.mastodon.content,
        content.bluesky.content,
        content.tone,
        [...content.twitter.hashtags, ...content.mastodon.hashtags],
      ]
    );

    return result.rows[0];
  }

  async update(id: string, data: Partial<GeneratedPost>): Promise<GeneratedPost | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const allowedFields = ['status', 'edited_content', 'content_twitter', 'content_mastodon', 'content_bluesky'];

    for (const [key, value] of Object.entries(data)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (allowedFields.includes(snakeKey)) {
        fields.push(`${snakeKey} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await query<GeneratedPost>(
      `UPDATE generated_posts SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async approve(id: string, userId: string): Promise<GeneratedPost | null> {
    const result = await query<GeneratedPost>(
      `UPDATE generated_posts SET
        status = 'approved',
        approved_by = $1,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = $2
      RETURNING *`,
      [userId, id]
    );

    return result.rows[0] || null;
  }

  async reject(id: string): Promise<GeneratedPost | null> {
    const result = await query<GeneratedPost>(
      `UPDATE generated_posts SET status = 'rejected', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }

  async markForRegeneration(id: string): Promise<GeneratedPost | null> {
    // Delete the old post and return it, the regeneration will create a new one
    const result = await query<GeneratedPost>(
      `DELETE FROM generated_posts WHERE id = $1 RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }
}
