import Parser from 'rss-parser';
import { logger } from '../../utils/logger.js';
import { withRetry } from '../../utils/retry.js';
import { RateLimiter } from '../../utils/rate-limiter.js';

export interface RSSItem {
  guid?: string;
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  creator?: string;
  author?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  description?: string;
  categories?: string[];
}

export interface RSSFeed {
  title?: string;
  description?: string;
  link?: string;
  items: RSSItem[];
  lastBuildDate?: string;
}

export interface FetchResult {
  success: boolean;
  feed?: RSSFeed;
  itemCount: number;
  error?: string;
  duration: number;
}

// Custom parser type with additional fields
type CustomFeed = {
  title?: string;
  description?: string;
  link?: string;
  lastBuildDate?: string;
};

type CustomItem = RSSItem;

class RSSFetcherService {
  private parser: Parser<CustomFeed, CustomItem>;
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private fetchCount = 0;
  private errorCount = 0;

  constructor() {
    this.parser = new Parser({
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'MediaScanner/1.0 (+https://github.com/media-scanner; RSS aggregator)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      customFields: {
        item: [
          ['media:content', 'mediaContent'],
          ['dc:creator', 'creator'],
          ['content:encoded', 'contentEncoded'],
        ],
      },
    });
  }

  /**
   * Fetch and parse an RSS feed
   */
  async fetchFeed(feedUrl: string, sourceSlug?: string): Promise<FetchResult> {
    const startTime = Date.now();
    this.fetchCount++;

    // Apply per-source rate limiting if we have a slug
    if (sourceSlug) {
      await this.waitForRateLimit(sourceSlug);
    }

    logger.debug({ feedUrl, sourceSlug }, 'Fetching RSS feed');

    try {
      const feed = await withRetry(
        async () => {
          return this.parser.parseURL(feedUrl);
        },
        {
          maxAttempts: 3,
          initialDelayMs: 2000,
          maxDelayMs: 15000,
          backoffMultiplier: 2,
          retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'socket hang up', '503', '502'],
        }
      );

      const duration = Date.now() - startTime;

      logger.info({
        feedUrl,
        sourceSlug,
        itemCount: feed.items.length,
        duration,
      }, 'RSS feed fetched successfully');

      return {
        success: true,
        feed: {
          title: feed.title,
          description: feed.description,
          link: feed.link,
          lastBuildDate: feed.lastBuildDate,
          items: feed.items.map(this.normalizeItem),
        },
        itemCount: feed.items.length,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.errorCount++;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({
        feedUrl,
        sourceSlug,
        error: errorMessage,
        duration,
      }, 'Failed to fetch RSS feed');

      return {
        success: false,
        itemCount: 0,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Fetch multiple feeds in parallel with concurrency limit
   */
  async fetchFeeds(
    feeds: Array<{ url: string; slug: string }>,
    concurrency = 5
  ): Promise<Map<string, FetchResult>> {
    const results = new Map<string, FetchResult>();

    // Process feeds in batches
    for (let i = 0; i < feeds.length; i += concurrency) {
      const batch = feeds.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(async (feed) => {
          const result = await this.fetchFeed(feed.url, feed.slug);
          return { slug: feed.slug, result };
        })
      );

      for (const { slug, result } of batchResults) {
        results.set(slug, result);
      }

      // Small delay between batches to avoid overwhelming servers
      if (i + concurrency < feeds.length) {
        await this.sleep(500);
      }
    }

    return results;
  }

  /**
   * Normalize an RSS item to a consistent format
   */
  private normalizeItem(item: CustomItem): RSSItem {
    return {
      guid: item.guid || item.link,
      title: item.title?.trim(),
      link: item.link?.trim(),
      pubDate: item.pubDate || item.isoDate,
      isoDate: item.isoDate,
      creator: item.creator || item.author,
      author: item.author || item.creator,
      // Prefer contentSnippet (plain text) over content (may contain HTML)
      content: item.contentSnippet || item.content || item.description,
      contentSnippet: item.contentSnippet,
      summary: item.summary || item.contentSnippet || item.description,
      description: item.description,
      categories: item.categories,
    };
  }

  /**
   * Get or create a rate limiter for a source
   */
  private getRateLimiter(sourceSlug: string): RateLimiter {
    if (!this.rateLimiters.has(sourceSlug)) {
      // Allow 10 requests per minute per source
      this.rateLimiters.set(
        sourceSlug,
        new RateLimiter({ tokensPerInterval: 10, interval: 60000 })
      );
    }
    return this.rateLimiters.get(sourceSlug)!;
  }

  /**
   * Wait for rate limit to allow request
   */
  private async waitForRateLimit(sourceSlug: string): Promise<void> {
    const limiter = this.getRateLimiter(sourceSlug);
    await limiter.waitForToken();
  }

  /**
   * Test if a feed URL is valid and accessible
   */
  async testFeed(feedUrl: string): Promise<{
    valid: boolean;
    title?: string;
    itemCount?: number;
    error?: string;
  }> {
    try {
      const result = await this.fetchFeed(feedUrl);

      if (result.success && result.feed) {
        return {
          valid: true,
          title: result.feed.title,
          itemCount: result.itemCount,
        };
      }

      return {
        valid: false,
        error: result.error,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get fetcher statistics
   */
  getStats() {
    return {
      totalFetches: this.fetchCount,
      totalErrors: this.errorCount,
      errorRate: this.fetchCount > 0
        ? ((this.errorCount / this.fetchCount) * 100).toFixed(1)
        : '0',
    };
  }
}

// Export singleton instance
export const rssFetcher = new RSSFetcherService();
