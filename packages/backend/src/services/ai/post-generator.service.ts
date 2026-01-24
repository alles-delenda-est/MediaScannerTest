import { claudeService } from './claude.service.js';
import {
  POST_GENERATION_SYSTEM_PROMPT,
  POST_GENERATION_USER_PROMPT,
  DAILY_SUMMARY_SYSTEM_PROMPT,
  DAILY_SUMMARY_USER_PROMPT,
} from '@media-scanner/shared';
import { logger } from '../../utils/logger.js';
import type { GeneratePostsResult } from '@media-scanner/shared';

export interface ArticleForPostGeneration {
  id: string;
  title: string;
  lede: string;
  url: string;
  relevanceReasoning: string;
  potentialAngle: string;
  sourceName: string;
}

interface RawPostGenerationResult {
  twitter: {
    content: string;
    hashtags: string[];
  };
  mastodon: {
    content: string;
    hashtags: string[];
  };
  bluesky: {
    content: string;
  };
  tone: string;
  quality_score: number;
}

interface RawDailySummaryResult {
  titre: string;
  introduction: string;
  points_cles: string[];
  conclusion: string;
}

export interface DailySummaryResult {
  title: string;
  introduction: string;
  keyPoints: string[];
  conclusion: string;
}

class PostGeneratorService {
  private generationCount = 0;

  /**
   * Generate social media posts for a relevant article
   */
  async generatePosts(article: ArticleForPostGeneration): Promise<GeneratePostsResult> {
    const startTime = Date.now();
    this.generationCount++;

    logger.debug({
      articleId: article.id,
      title: article.title.slice(0, 50),
    }, 'Starting post generation');

    try {
      const result = await claudeService.chatJson<RawPostGenerationResult>(
        [
          {
            role: 'user',
            content: POST_GENERATION_USER_PROMPT({
              title: article.title,
              lede: article.lede,
              relevanceReasoning: article.relevanceReasoning,
              potentialAngle: article.potentialAngle,
            }),
          },
        ],
        {
          model: 'claude-3-haiku-20240307', // Better quality for creative generation
          maxTokens: 1000,
          temperature: 0.8, // Higher temperature for creativity
          systemPrompt: POST_GENERATION_SYSTEM_PROMPT,
        }
      );

      const normalizedResult = this.normalizePostResult(result, article.url);

      const duration = Date.now() - startTime;

      logger.info({
        articleId: article.id,
        tone: normalizedResult.tone,
        qualityScore: normalizedResult.qualityScore,
        duration,
      }, 'Post generation completed');

      return normalizedResult;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error({
        articleId: article.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      }, 'Post generation failed');

      throw error;
    }
  }

  /**
   * Generate posts with retry and fallback
   */
  async generatePostsSafe(article: ArticleForPostGeneration): Promise<GeneratePostsResult | null> {
    try {
      return await this.generatePosts(article);
    } catch (error) {
      logger.error({
        articleId: article.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Post generation failed, returning null');

      return null;
    }
  }

  /**
   * Regenerate posts with custom instructions
   */
  async regeneratePosts(
    article: ArticleForPostGeneration,
    instructions: string
  ): Promise<GeneratePostsResult> {
    const customPrompt = `${POST_GENERATION_USER_PROMPT({
      title: article.title,
      lede: article.lede,
      relevanceReasoning: article.relevanceReasoning,
      potentialAngle: article.potentialAngle,
    })}

INSTRUCTIONS SUPPLÉMENTAIRES:
${instructions}`;

    const result = await claudeService.chatJson<RawPostGenerationResult>(
      [{ role: 'user', content: customPrompt }],
      {
        model: 'claude-3-haiku-20240307',
        maxTokens: 1000,
        temperature: 0.8,
        systemPrompt: POST_GENERATION_SYSTEM_PROMPT,
      }
    );

    return this.normalizePostResult(result, article.url);
  }

  /**
   * Generate a daily summary of relevant articles
   */
  async generateDailySummary(
    articles: Array<{
      title: string;
      source: string;
      relevanceScore: number;
      reasoning: string;
    }>
  ): Promise<DailySummaryResult> {
    logger.debug({ articleCount: articles.length }, 'Starting daily summary generation');

    if (articles.length === 0) {
      return {
        title: 'Aucun article pertinent aujourd\'hui',
        introduction: 'Aucun article particulièrement pertinent n\'a été identifié dans la veille du jour.',
        keyPoints: [],
        conclusion: '',
      };
    }

    try {
      const result = await claudeService.chatJson<RawDailySummaryResult>(
        [
          {
            role: 'user',
            content: DAILY_SUMMARY_USER_PROMPT(articles),
          },
        ],
        {
          model: 'claude-3-haiku-20240307',
          maxTokens: 1500,
          temperature: 0.6,
          systemPrompt: DAILY_SUMMARY_SYSTEM_PROMPT,
        }
      );

      return {
        title: result.titre || 'Synthèse du jour',
        introduction: result.introduction || '',
        keyPoints: result.points_cles || [],
        conclusion: result.conclusion || '',
      };
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Daily summary generation failed');

      return {
        title: 'Synthèse du jour',
        introduction: `${articles.length} articles pertinents identifiés aujourd'hui.`,
        keyPoints: articles.slice(0, 5).map(a => a.title),
        conclusion: '',
      };
    }
  }

  /**
   * Normalize and validate the post generation result
   */
  private normalizePostResult(
    raw: RawPostGenerationResult,
    articleUrl: string
  ): GeneratePostsResult {
    // Ensure Twitter content fits within limit
    let twitterContent = raw.twitter?.content || '';
    if (twitterContent.length > 280) {
      twitterContent = twitterContent.slice(0, 277) + '...';
    }

    // Ensure Mastodon content fits within limit
    let mastodonContent = raw.mastodon?.content || '';
    if (mastodonContent.length > 500) {
      mastodonContent = mastodonContent.slice(0, 497) + '...';
    }

    // Ensure Bluesky content fits within limit
    let blueskyContent = raw.bluesky?.content || '';
    if (blueskyContent.length > 300) {
      blueskyContent = blueskyContent.slice(0, 297) + '...';
    }

    // Clean up hashtags
    const cleanHashtags = (tags: string[] | undefined): string[] => {
      if (!Array.isArray(tags)) return [];
      return tags
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .filter(tag => tag.length > 1 && tag.length <= 30)
        .slice(0, 5);
    };

    return {
      twitter: {
        content: twitterContent,
        hashtags: cleanHashtags(raw.twitter?.hashtags),
      },
      mastodon: {
        content: mastodonContent,
        hashtags: cleanHashtags(raw.mastodon?.hashtags),
      },
      bluesky: {
        content: blueskyContent,
      },
      tone: raw.tone || 'ironic',
      qualityScore: Math.max(0, Math.min(1, raw.quality_score || 0.5)),
    };
  }

  /**
   * Get generation statistics
   */
  getStats() {
    return {
      totalGenerated: this.generationCount,
    };
  }
}

// Export singleton instance
export const postGenerator = new PostGeneratorService();
