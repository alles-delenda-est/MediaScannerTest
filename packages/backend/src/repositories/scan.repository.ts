import { query } from '../config/database.js';
import type { ScanLog, PaginatedResponse, ScanType, ScanStatus } from '@media-scanner/shared';

interface ScanStatusResult {
  isRunning: boolean;
  currentScan: ScanLog | null;
  lastCompletedScan: ScanLog | null;
}

export class ScanRepository {
  async findAll(params: { page: number; limit: number }): Promise<PaginatedResponse<ScanLog>> {
    const { page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    const countResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM scan_logs');
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await query<ScanLog>(
      `SELECT sl.*, s.name as source_name
       FROM scan_logs sl
       LEFT JOIN sources s ON sl.source_id = s.id
       ORDER BY sl.started_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      data: dataResult.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<ScanLog | null> {
    const result = await query<ScanLog>(
      `SELECT sl.*, s.name as source_name
       FROM scan_logs sl
       LEFT JOIN sources s ON sl.source_id = s.id
       WHERE sl.id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  async getCurrentStatus(): Promise<ScanStatusResult> {
    const runningResult = await query<ScanLog>(
      `SELECT * FROM scan_logs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1`
    );

    const lastCompletedResult = await query<ScanLog>(
      `SELECT * FROM scan_logs WHERE status IN ('completed', 'partial') ORDER BY completed_at DESC LIMIT 1`
    );

    return {
      isRunning: runningResult.rows.length > 0,
      currentScan: runningResult.rows[0] || null,
      lastCompletedScan: lastCompletedResult.rows[0] || null,
    };
  }

  async createManualScan(type: string, sourceId?: string): Promise<ScanLog> {
    const result = await query<ScanLog>(
      `INSERT INTO scan_logs (source_id, scan_type, status)
       VALUES ($1, $2, 'running')
       RETURNING *`,
      [sourceId || null, type as ScanType]
    );

    return result.rows[0];
  }

  async create(sourceId: string | null, scanType: ScanType): Promise<ScanLog> {
    const result = await query<ScanLog>(
      `INSERT INTO scan_logs (source_id, scan_type, status)
       VALUES ($1, $2, 'running')
       RETURNING *`,
      [sourceId, scanType]
    );

    return result.rows[0];
  }

  async updateProgress(id: string, stats: {
    itemsFound?: number;
    itemsNew?: number;
    itemsAnalyzed?: number;
    itemsRelevant?: number;
  }): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(stats)) {
      if (value !== undefined) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        fields.push(`${snakeKey} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;

    values.push(id);
    await query(
      `UPDATE scan_logs SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }

  async complete(id: string, status: ScanStatus = 'completed'): Promise<void> {
    await query(
      `UPDATE scan_logs SET status = $1, completed_at = NOW() WHERE id = $2`,
      [status, id]
    );
  }

  async fail(id: string, error: string, stack?: string): Promise<void> {
    await query(
      `UPDATE scan_logs SET
        status = 'failed',
        completed_at = NOW(),
        error_message = $1,
        error_stack = $2
      WHERE id = $3`,
      [error, stack || null, id]
    );
  }
}
