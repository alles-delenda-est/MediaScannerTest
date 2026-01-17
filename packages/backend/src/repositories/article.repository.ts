import { query } from '../config/database.js';
import { hashUrl } from '@media-scanner/shared';
import type {
  Article,
  ArticleWithSource,
  ArticleQueryParams,
  PaginatedResponse,
  GeneratedPost,
  CreateArticleInput,
} from '@media-scanner/shared';

export class ArticleRepository {
  async findAll(params: ArticleQueryParams): Promise<PaginatedResponse<ArticleWithSource>> {
    const {
      status,
      sourceId,
      from,
      to,
      minScore,
      category,
      search,
      page = 1,
      limit = 20,
      sort = 'date',
      order = 'desc',
    } = params;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`a.status = $${paramIndex++}`);
      values.push(status);
    }

    if (sourceId) {
      conditions.push(`a.source_id = $${paramIndex++}`);
      values.push(sourceId);
    }

    if (from) {
      conditions.push(`a.published_at >= $${paramIndex++}`);
      values.push(from);
    }

    if (to) {
      conditions.push(`a.published_at <= $${paramIndex++}`);
      values.push(to);
    }

    if (minScore !== undefined) {
      conditions.push(`a.relevance_score >= $${paramIndex++}`);
      values.push(minScore);
    }

    if (category) {
      conditions.push(`$${paramIndex++} = ANY(a.categories)`);
      values.push(category);
    }

    if (search) {
      conditions.push(`(a.title ILIKE $${paramIndex} OR a.lede ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderColumn = sort === 'relevance' ? 'a.relevance_score' : 'a.published_at';
    const orderDirection = order.toUpperCase();
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM articles a ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const dataResult = await query<ArticleWithSource>(
      `SELECT
        a.*,
        json_build_object(
          'id', s.id,
          'name', s.name,
          'slug', s.slug,
          'type', s.type,
          'category', s.category
        ) as source
      FROM articles a
      LEFT JOIN sources s ON a.source_id = s.id
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection} NULLS LAST
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<ArticleWithSource | null> {
    const result = await query<ArticleWithSource>(
      `SELECT
        a.*,
        json_build_object(
          'id', s.id,
          'name', s.name,
          'slug', s.slug,
          'type', s.type,
          'category', s.category,
          'region', s.region
        ) as source
      FROM articles a
      LEFT JOIN sources s ON a.source_id = s.id
      WHERE a.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  async findByUrlHash(urlHash: string): Promise<Article | null> {
    const result = await query<Article>(
      'SELECT * FROM articles WHERE url_hash = $1',
      [urlHash]
    );

    return result.rows[0] || null;
  }

  async create(input: CreateArticleInput): Promise<Article> {
    const urlHash = hashUrl(input.url);

    const result = await query<Article>(
      `INSERT INTO articles (
        source_id, external_id, url, url_hash, title, lede, full_text,
        author, published_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      ON CONFLICT (url_hash) DO NOTHING
      RETURNING *`,
      [
        input.sourceId,
        input.externalId || null,
        input.url,
        urlHash,
        input.title,
        input.lede || null,
        input.fullText || null,
        input.author || null,
        input.publishedAt || null,
      ]
    );

    return result.rows[0];
  }

  async update(id: string, data: Partial<Article>): Promise<Article | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const allowedFields = ['status', 'relevance_score', 'relevance_reasoning', 'keywords', 'categories', 'potential_angle'];

    for (const [key, value] of Object.entries(data)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (allowedFields.includes(snakeKey)) {
        fields.push(`${snakeKey} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await query<Article>(
      `UPDATE articles SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async updateAnalysis(id: string, analysis: {
    relevanceScore: number;
    relevanceReasoning: string;
    keywords: string[];
    categories: string[];
    potentialAngle: string;
  }): Promise<Article | null> {
    const status = analysis.relevanceScore >= 0.5 ? 'relevant' : 'irrelevant';

    const result = await query<Article>(
      `UPDATE articles SET
        status = $1,
        relevance_score = $2,
        relevance_reasoning = $3,
        keywords = $4,
        categories = $5,
        potential_angle = $6,
        analyzed_at = NOW(),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *`,
      [
        status,
        analysis.relevanceScore,
        analysis.relevanceReasoning,
        analysis.keywords,
        analysis.categories,
        analysis.potentialAngle,
        id,
      ]
    );

    return result.rows[0] || null;
  }

  async markForReanalysis(id: string): Promise<void> {
    await query(
      `UPDATE articles SET status = 'pending', analyzed_at = NULL WHERE id = $1`,
      [id]
    );
  }

  async delete(id: string): Promise<void> {
    // Soft delete by setting status to 'error' or actually delete
    await query('DELETE FROM articles WHERE id = $1', [id]);
  }

  async findPostsForArticle(articleId: string): Promise<GeneratedPost[]> {
    const result = await query<GeneratedPost>(
      `SELECT * FROM generated_posts WHERE article_id = $1 ORDER BY created_at DESC`,
      [articleId]
    );

    return result.rows;
  }

  async findPendingForAnalysis(limit = 100): Promise<Article[]> {
    const result = await query<Article>(
      `SELECT * FROM articles
       WHERE status = 'pending'
       ORDER BY published_at DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  async findRelevantForPostGeneration(limit = 50): Promise<Article[]> {
    const result = await query<Article>(
      `SELECT a.* FROM articles a
       LEFT JOIN generated_posts gp ON a.id = gp.article_id
       WHERE a.status = 'relevant'
         AND a.relevance_score >= 0.6
         AND gp.id IS NULL
       ORDER BY a.relevance_score DESC, a.published_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }
}
