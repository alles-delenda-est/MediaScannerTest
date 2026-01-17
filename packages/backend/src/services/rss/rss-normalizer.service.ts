import { hashUrl } from '@media-scanner/shared';
import type { RSSItem } from './rss-fetcher.service.js';
import type { CreateArticleInput } from '@media-scanner/shared';
import { logger } from '../../utils/logger.js';

export interface NormalizedArticle extends CreateArticleInput {
  urlHash: string;
}

interface NormalizationResult {
  articles: NormalizedArticle[];
  skipped: number;
  reasons: Record<string, number>;
}

class RSSNormalizerService {
  /**
   * Normalize RSS items into article format
   */
  normalizeItems(
    items: RSSItem[],
    sourceId: string,
    sourceName: string
  ): NormalizationResult {
    const articles: NormalizedArticle[] = [];
    const reasons: Record<string, number> = {};
    let skipped = 0;

    for (const item of items) {
      const result = this.normalizeItem(item, sourceId, sourceName);

      if (result.article) {
        articles.push(result.article);
      } else {
        skipped++;
        reasons[result.reason!] = (reasons[result.reason!] || 0) + 1;
      }
    }

    if (skipped > 0) {
      logger.debug({
        sourceId,
        total: items.length,
        normalized: articles.length,
        skipped,
        reasons,
      }, 'RSS items normalized');
    }

    return { articles, skipped, reasons };
  }

  /**
   * Normalize a single RSS item
   */
  private normalizeItem(
    item: RSSItem,
    sourceId: string,
    sourceName: string
  ): { article?: NormalizedArticle; reason?: string } {
    // Validate required fields
    if (!item.link) {
      return { reason: 'missing_link' };
    }

    if (!item.title || item.title.trim().length < 5) {
      return { reason: 'missing_or_short_title' };
    }

    // Clean and validate URL
    const url = this.cleanUrl(item.link);
    if (!url) {
      return { reason: 'invalid_url' };
    }

    // Extract lede (summary/description)
    const lede = this.extractLede(item);

    // Skip articles without meaningful content
    if (!lede || lede.length < 30) {
      return { reason: 'insufficient_content' };
    }

    // Parse publication date
    const publishedAt = this.parseDate(item.pubDate || item.isoDate);

    // Skip very old articles (more than 7 days)
    if (publishedAt && this.isOlderThan(publishedAt, 7)) {
      return { reason: 'too_old' };
    }

    // Build the normalized article
    const article: NormalizedArticle = {
      sourceId,
      externalId: item.guid || url,
      url,
      urlHash: hashUrl(url),
      title: this.cleanText(item.title),
      lede: this.cleanText(lede),
      fullText: item.content ? this.cleanText(item.content) : undefined,
      author: item.author || item.creator || undefined,
      publishedAt,
    };

    return { article };
  }

  /**
   * Extract the best available lede/summary from an RSS item
   */
  private extractLede(item: RSSItem): string | null {
    // Priority: contentSnippet > summary > description > content
    const candidates = [
      item.contentSnippet,
      item.summary,
      item.description,
      item.content,
    ];

    for (const candidate of candidates) {
      if (candidate && candidate.trim().length > 0) {
        // Strip HTML tags and get first 500 chars
        const cleaned = this.stripHtml(candidate);
        if (cleaned.length >= 30) {
          return cleaned.slice(0, 500);
        }
      }
    }

    return null;
  }

  /**
   * Clean and validate a URL
   */
  private cleanUrl(url: string): string | null {
    try {
      const cleaned = url.trim();

      // Skip non-HTTP URLs
      if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
        return null;
      }

      // Validate URL structure
      const parsed = new URL(cleaned);

      // Return normalized URL
      return parsed.href;
    } catch {
      return null;
    }
  }

  /**
   * Parse a date string into a Date object
   */
  private parseDate(dateString?: string): Date | undefined {
    if (!dateString) return undefined;

    try {
      const date = new Date(dateString);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return undefined;
      }

      // Check if date is in reasonable range (not in future, not too old)
      const now = new Date();
      if (date > now) {
        return now; // Cap at current time
      }

      return date;
    } catch {
      return undefined;
    }
  }

  /**
   * Check if a date is older than X days
   */
  private isOlderThan(date: Date, days: number): boolean {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return date < cutoff;
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .replace(/<[^>]+>/g, ' ') // Remove all other tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Clean and normalize text
   */
  private cleanText(text: string): string {
    return this.stripHtml(text)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if an article matches keywords for a specific topic
   * (Quick pre-filter before AI analysis)
   */
  quickRelevanceCheck(article: NormalizedArticle, keywords: string[]): boolean {
    const text = `${article.title} ${article.lede || ''}`.toLowerCase();
    return keywords.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Check an article against all provided topics and return matching topic IDs
   */
  checkAgainstTopics(
    article: NormalizedArticle,
    topics: Array<{ id: string; keywords: string[] }>
  ): string[] {
    const matchedTopicIds: string[] = [];

    for (const topic of topics) {
      if (this.quickRelevanceCheck(article, topic.keywords)) {
        matchedTopicIds.push(topic.id);
      }
    }

    return matchedTopicIds;
  }

  /**
   * Legacy method for backward compatibility - uses default hardcoded keywords
   * @deprecated Use checkAgainstTopics with topics from database instead
   */
  quickRelevanceCheckLegacy(article: NormalizedArticle): boolean {
    const defaultKeywords = [
      'administration', 'bureaucratie', 'bureaucratique', 'réglementation',
      'réglementaire', 'paperasse', 'formulaire', 'cerfa', 'norme', 'normatif',
      'complexité', 'simplification', 'simplifier', 'fonctionnaire', 'fonctionnaires',
      'service public', 'services publics', 'impôt', 'impôts', 'fiscal', 'fiscalité',
      'taxe', 'taxes', 'prélèvement', 'cotisation', 'dépense publique',
      'dépenses publiques', 'gaspillage', 'collectivité', 'collectivités', 'mairie',
      'préfecture', 'délai', 'délais', 'procédure', 'procédures', 'démarche',
      'démarches', 'absurde', 'aberrant', 'kafkaïen', 'usine à gaz', 'mille-feuille',
      'surtaxe', 'surréglementation',
    ];
    return this.quickRelevanceCheck(article, defaultKeywords);
  }
}

// Export singleton instance
export const rssNormalizer = new RSSNormalizerService();
