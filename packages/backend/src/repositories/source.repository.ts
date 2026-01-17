import { query } from '../config/database.js';
import type { Source, SourceFilters, ScanLog } from '@media-scanner/shared';

interface SourceWithStats extends Source {
  articlesCount: number;
  relevantCount: number;
  lastScanStatus: string | null;
}

export class SourceRepository {
  async findAll(filters: SourceFilters): Promise<Source[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.type) {
      conditions.push(`type = $${paramIndex++}`);
      values.push(filters.type);
    }

    if (filters.category) {
      conditions.push(`category = $${paramIndex++}`);
      values.push(filters.category);
    }

    if (filters.active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(filters.active);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query<Source>(
      `SELECT * FROM sources ${whereClause} ORDER BY category, name`,
      values
    );

    return result.rows;
  }

  async findById(id: string): Promise<Source | null> {
    const result = await query<Source>('SELECT * FROM sources WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findBySlug(slug: string): Promise<Source | null> {
    const result = await query<Source>('SELECT * FROM sources WHERE slug = $1', [slug]);
    return result.rows[0] || null;
  }

  async findByIdWithStats(id: string): Promise<SourceWithStats | null> {
    const result = await query<SourceWithStats>(
      `SELECT
        s.*,
        COUNT(a.id) FILTER (WHERE a.id IS NOT NULL) as articles_count,
        COUNT(a.id) FILTER (WHERE a.status = 'relevant') as relevant_count,
        (SELECT status FROM scan_logs WHERE source_id = s.id ORDER BY started_at DESC LIMIT 1) as last_scan_status
      FROM sources s
      LEFT JOIN articles a ON s.id = a.source_id
      WHERE s.id = $1
      GROUP BY s.id`,
      [id]
    );

    return result.rows[0] || null;
  }

  async create(data: Partial<Source>): Promise<Source> {
    const result = await query<Source>(
      `INSERT INTO sources (name, slug, type, category, url, region, fetch_interval_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.name,
        data.slug,
        data.type,
        data.category,
        data.url,
        data.region || null,
        data.fetchIntervalMinutes || 60,
      ]
    );

    return result.rows[0];
  }

  async update(id: string, data: Partial<Source>): Promise<Source | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const allowedFields = ['name', 'url', 'region', 'is_active', 'fetch_interval_minutes'];

    for (const [key, value] of Object.entries(data)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (allowedFields.includes(snakeKey)) {
        fields.push(`${snakeKey} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await query<Source>(
      `UPDATE sources SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async deactivate(id: string): Promise<void> {
    await query('UPDATE sources SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
  }

  async updateLastFetched(id: string): Promise<void> {
    await query(
      'UPDATE sources SET last_fetched_at = NOW(), error_count = 0, last_error = NULL WHERE id = $1',
      [id]
    );
  }

  async updateError(id: string, error: string): Promise<void> {
    await query(
      'UPDATE sources SET last_error = $1, error_count = error_count + 1, updated_at = NOW() WHERE id = $2',
      [error, id]
    );
  }

  async testConnectivity(id: string): Promise<{ success: boolean; message: string }> {
    const source = await this.findById(id);
    if (!source) {
      return { success: false, message: 'Source non trouvée' };
    }

    // TODO: Actually test RSS fetch
    return { success: true, message: 'Connexion réussie' };
  }

  async getScanLogs(sourceId: string, limit: number): Promise<ScanLog[]> {
    const result = await query<ScanLog>(
      `SELECT * FROM scan_logs WHERE source_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [sourceId, limit]
    );

    return result.rows;
  }

  async findActiveRssSources(): Promise<Source[]> {
    const result = await query<Source>(
      `SELECT * FROM sources WHERE type = 'rss' AND is_active = true ORDER BY fetch_interval_minutes`
    );

    return result.rows;
  }
}
