import { query } from '../config/database.js';
import type { Topic, TopicFilters, CreateTopicInput, UpdateTopicInput } from '@media-scanner/shared';
import { slugify } from '@media-scanner/shared/utils';

interface DbTopic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  keywords: string[];
  ai_prompt: string;
  min_relevance_score: string;
  is_active: boolean;
  is_system: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapDbToTopic(row: DbTopic): Topic {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    keywords: row.keywords,
    aiPrompt: row.ai_prompt,
    minRelevanceScore: parseFloat(row.min_relevance_score),
    isActive: row.is_active,
    isSystem: row.is_system,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TopicRepository {
  async findAll(filters?: TopicFilters): Promise<Topic[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters?.active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(filters.active);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query<DbTopic>(
      `SELECT * FROM topics ${whereClause} ORDER BY is_system DESC, name`,
      values
    );

    return result.rows.map(mapDbToTopic);
  }

  async findById(id: string): Promise<Topic | null> {
    const result = await query<DbTopic>('SELECT * FROM topics WHERE id = $1', [id]);
    return result.rows[0] ? mapDbToTopic(result.rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<Topic | null> {
    const result = await query<DbTopic>('SELECT * FROM topics WHERE slug = $1', [slug]);
    return result.rows[0] ? mapDbToTopic(result.rows[0]) : null;
  }

  async findActive(): Promise<Topic[]> {
    const result = await query<DbTopic>(
      'SELECT * FROM topics WHERE is_active = true ORDER BY is_system DESC, name'
    );
    return result.rows.map(mapDbToTopic);
  }

  async create(data: CreateTopicInput, userId?: string): Promise<Topic> {
    const slug = slugify(data.name);

    const result = await query<DbTopic>(
      `INSERT INTO topics (name, slug, description, keywords, ai_prompt, min_relevance_score, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.name,
        slug,
        data.description || null,
        data.keywords,
        data.aiPrompt,
        data.minRelevanceScore ?? 0.5,
        data.isActive ?? true,
        userId || null,
      ]
    );

    return mapDbToTopic(result.rows[0]);
  }

  async update(id: string, data: UpdateTopicInput): Promise<Topic | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
      fields.push(`slug = $${paramIndex++}`);
      values.push(slugify(data.name));
    }

    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (data.keywords !== undefined) {
      fields.push(`keywords = $${paramIndex++}`);
      values.push(data.keywords);
    }

    if (data.aiPrompt !== undefined) {
      fields.push(`ai_prompt = $${paramIndex++}`);
      values.push(data.aiPrompt);
    }

    if (data.minRelevanceScore !== undefined) {
      fields.push(`min_relevance_score = $${paramIndex++}`);
      values.push(data.minRelevanceScore);
    }

    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await query<DbTopic>(
      `UPDATE topics SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] ? mapDbToTopic(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    // Check if it's a system topic
    const topic = await this.findById(id);
    if (!topic) return false;
    if (topic.isSystem) {
      throw new Error('Cannot delete system topics');
    }

    const result = await query('DELETE FROM topics WHERE id = $1 AND is_system = false', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async toggleActive(id: string): Promise<Topic | null> {
    const result = await query<DbTopic>(
      'UPDATE topics SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] ? mapDbToTopic(result.rows[0]) : null;
  }
}
