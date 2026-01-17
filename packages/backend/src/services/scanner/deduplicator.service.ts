import { query } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { hashUrl } from '@media-scanner/shared';
import { logger } from '../../utils/logger.js';
import type { NormalizedArticle } from '../rss/rss-normalizer.service.js';

const REDIS_KEY_PREFIX = 'url_hash:';
const CACHE_TTL_SECONDS = 86400 * 7; // 7 days

interface DeduplicationResult {
  newArticles: NormalizedArticle[];
  duplicates: number;
  cacheHits: number;
  dbChecks: number;
}

class DeduplicatorService {
  /**
   * Filter out articles that already exist in the database
   */
  async filterDuplicates(articles: NormalizedArticle[]): Promise<DeduplicationResult> {
    const newArticles: NormalizedArticle[] = [];
    let duplicates = 0;
    let cacheHits = 0;
    let dbChecks = 0;

    // First, batch check Redis cache
    const urlHashes = articles.map((a) => a.urlHash);
    const cacheResults = await this.batchCheckCache(urlHashes);

    // Collect articles that need database check
    const needsDbCheck: NormalizedArticle[] = [];

    for (const article of articles) {
      const cachedResult = cacheResults.get(article.urlHash);

      if (cachedResult === 'exists') {
        duplicates++;
        cacheHits++;
      } else if (cachedResult === 'new') {
        // Confirmed new from cache
        newArticles.push(article);
        cacheHits++;
      } else {
        // Not in cache, need to check database
        needsDbCheck.push(article);
      }
    }

    // Batch check database for uncached articles
    if (needsDbCheck.length > 0) {
      const dbResults = await this.batchCheckDatabase(
        needsDbCheck.map((a) => a.urlHash)
      );
      dbChecks = needsDbCheck.length;

      for (const article of needsDbCheck) {
        const existsInDb = dbResults.has(article.urlHash);

        if (existsInDb) {
          duplicates++;
          // Cache as existing
          await this.cacheUrlHash(article.urlHash, true);
        } else {
          newArticles.push(article);
          // Cache as new (temporarily, will be updated when inserted)
          await this.cacheUrlHash(article.urlHash, false);
        }
      }
    }

    logger.debug({
      total: articles.length,
      new: newArticles.length,
      duplicates,
      cacheHits,
      dbChecks,
    }, 'Deduplication complete');

    return {
      newArticles,
      duplicates,
      cacheHits,
      dbChecks,
    };
  }

  /**
   * Check if a single URL already exists
   */
  async isDuplicate(url: string): Promise<boolean> {
    const urlHash = hashUrl(url);

    // Check cache first
    const cached = await this.checkCache(urlHash);
    if (cached !== null) {
      return cached;
    }

    // Check database
    const exists = await this.checkDatabase(urlHash);

    // Update cache
    await this.cacheUrlHash(urlHash, exists);

    return exists;
  }

  /**
   * Mark a URL as stored (after successful insert)
   */
  async markAsStored(url: string): Promise<void> {
    const urlHash = hashUrl(url);
    await this.cacheUrlHash(urlHash, true);
  }

  /**
   * Batch mark URLs as stored
   */
  async markBatchAsStored(urls: string[]): Promise<void> {
    if (urls.length === 0) return;

    const pipeline = redis.pipeline();

    for (const url of urls) {
      const urlHash = hashUrl(url);
      pipeline.setex(`${REDIS_KEY_PREFIX}${urlHash}`, CACHE_TTL_SECONDS, 'exists');
    }

    await pipeline.exec();
  }

  /**
   * Batch check Redis cache for URL hashes
   */
  private async batchCheckCache(
    urlHashes: string[]
  ): Promise<Map<string, 'exists' | 'new' | null>> {
    const results = new Map<string, 'exists' | 'new' | null>();

    if (urlHashes.length === 0) return results;

    try {
      const keys = urlHashes.map((h) => `${REDIS_KEY_PREFIX}${h}`);
      const values = await redis.mget(...keys);

      for (let i = 0; i < urlHashes.length; i++) {
        const value = values[i];
        if (value === 'exists') {
          results.set(urlHashes[i], 'exists');
        } else if (value === 'new') {
          results.set(urlHashes[i], 'new');
        } else {
          results.set(urlHashes[i], null);
        }
      }
    } catch (error) {
      logger.warn({ error }, 'Redis cache check failed, falling back to database');
      // Return all as null (unknown) to trigger database checks
      for (const hash of urlHashes) {
        results.set(hash, null);
      }
    }

    return results;
  }

  /**
   * Check a single URL hash in cache
   */
  private async checkCache(urlHash: string): Promise<boolean | null> {
    try {
      const value = await redis.get(`${REDIS_KEY_PREFIX}${urlHash}`);
      if (value === 'exists') return true;
      if (value === 'new') return false;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Cache a URL hash with its existence status
   */
  private async cacheUrlHash(urlHash: string, exists: boolean): Promise<void> {
    try {
      await redis.setex(
        `${REDIS_KEY_PREFIX}${urlHash}`,
        CACHE_TTL_SECONDS,
        exists ? 'exists' : 'new'
      );
    } catch (error) {
      logger.warn({ error, urlHash }, 'Failed to cache URL hash');
    }
  }

  /**
   * Batch check database for URL hashes
   */
  private async batchCheckDatabase(urlHashes: string[]): Promise<Set<string>> {
    const existingHashes = new Set<string>();

    if (urlHashes.length === 0) return existingHashes;

    try {
      // Query in batches of 100 to avoid huge IN clauses
      const batchSize = 100;

      for (let i = 0; i < urlHashes.length; i += batchSize) {
        const batch = urlHashes.slice(i, i + batchSize);
        const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(',');

        const result = await query<{ url_hash: string }>(
          `SELECT url_hash FROM articles WHERE url_hash IN (${placeholders})`,
          batch
        );

        for (const row of result.rows) {
          existingHashes.add(row.url_hash);
        }
      }
    } catch (error) {
      logger.error({ error }, 'Database check for duplicates failed');
      throw error;
    }

    return existingHashes;
  }

  /**
   * Check a single URL hash in database
   */
  private async checkDatabase(urlHash: string): Promise<boolean> {
    const result = await query<{ url_hash: string }>(
      'SELECT url_hash FROM articles WHERE url_hash = $1 LIMIT 1',
      [urlHash]
    );

    return result.rows.length > 0;
  }

  /**
   * Clear cache for a specific URL (useful for reprocessing)
   */
  async clearCache(url: string): Promise<void> {
    const urlHash = hashUrl(url);
    await redis.del(`${REDIS_KEY_PREFIX}${urlHash}`);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ size: number }> {
    try {
      const keys = await redis.keys(`${REDIS_KEY_PREFIX}*`);
      return { size: keys.length };
    } catch {
      return { size: 0 };
    }
  }
}

// Export singleton instance
export const deduplicator = new DeduplicatorService();
